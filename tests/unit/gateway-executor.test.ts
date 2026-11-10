import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { issueMandate, verifyMandate } from "@/rooms/authorize/mandates";
import { DevStubGateway } from "@/rooms/execute/devStub";
import {
  executeCreateOrder,
  executeCaptureOrder,
  getPaymentGateway,
} from "@/rooms/execute/executor";
import { GatewayCreateOrderInput } from "@/rooms/execute/types";

describe("Payment Gateway Interface & Executor Service (PRD §8, §5.2)", () => {
  const wsId = "ws_test_exec_01";
  const proposalId = "prop_exec_test_01";
  const policyVersionId = "pv_exec_v1";
  const proposalHash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  beforeAll(async () => {
    process.env.PAYMENT_MODE = "dev_stub";
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long-for-hmac";

    // Clean up
    await db.delete(schema.paypalCaptures).where(eq(schema.paypalCaptures.workspaceId, wsId));
    await db.delete(schema.paypalOrders).where(eq(schema.paypalOrders.workspaceId, wsId));
    await db.delete(schema.mandates).where(eq(schema.mandates.workspaceId, wsId));
    await db.delete(schema.evaluations).where(eq(schema.evaluations.workspaceId, wsId));
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsId));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsId));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsId));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsId));

    // Seed
    await db.insert(schema.workspaces).values({ id: wsId });
    await db.insert(schema.policies).values({ id: "pol_exec", workspaceId: wsId });
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_exec",
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        currency: "USD",
        cart_max_cents: 15000,
        per_item_max_cents: 12000,
        approval_threshold_cents: 5000,
        daily_cap_cents: 200000,
        merchant_mode: "DENYLIST",
        merchants: [],
        blocked_categories: [],
        status: "ACTIVE",
        valid_from: new Date(Date.now() - 3600_000).toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
      },
    });

    await db.insert(schema.proposals).values({
      id: proposalId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "SKU-KEYBOARD-01",
          title: "Keychron K2",
          unit_price_cents: 8499,
          quantity: 1,
          merchant_domain: "keychron.com",
          price_fetched_at: new Date().toISOString(),
          server_price_cents: 8499,
        },
      ],
      totalCents: 8499,
      currency: "USD",
      proposalHash,
      state: "APPROVED",
      policyVersionId,
    });
  });

  it("DevStubGateway creates an order anchored to custom_id = proposalHash and labels response dev_stub", async () => {
    const gateway = new DevStubGateway();

    // Issue a verified mandate
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    const orderInput: GatewayCreateOrderInput = {
      proposalId,
      proposalHash,
      amountCents: 8499,
      currency: "USD",
      items: [
        {
          sku: "SKU-KEYBOARD-01",
          name: "Keychron K2",
          unitPriceCents: 8499,
          quantity: 1,
        },
      ],
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
      requestId: `create-${mandate.jti}`,
    };

    const result = await gateway.createOrder(mandate, orderInput);

    expect(result.orderId).toContain("DEV-ORDER-");
    expect(result.status).toBe("CREATED");
    expect(result.source).toBe("dev_stub");
    expect(result.label).toContain("dev_stub");
    expect(result.customId).toBe(proposalHash);
    expect(result.approveUrl).toBeDefined();
    expect(result.approveUrl).toContain("/dev-stub/buyer-approval");
  });

  it("executor service creates an order with persisted idempotency key and updates state to ORDER_CREATED", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    const gateway = new DevStubGateway();
    const result = await executeCreateOrder({
      mandate,
      gateway,
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
    });

    expect(result.orderId).toBeDefined();
    expect(result.status).toBe("CREATED");

    // Check DB record
    const dbOrders = await db
      .select()
      .from(schema.paypalOrders)
      .where(eq(schema.paypalOrders.proposalId, proposalId));
    expect(dbOrders.length).toBeGreaterThan(0);
    expect(dbOrders[0].requestId).toBe(`create-${mandate.jti}`);
    expect(dbOrders[0].paypalOrderId).toBe(result.orderId);

    // Verify idempotency: re-running with same mandate returns same order without new gateway creation
    const repeatResult = await executeCreateOrder({
      mandate,
      gateway,
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
    });

    expect(repeatResult.orderId).toBe(result.orderId);
  });

  it("executor service captures order atomically consuming mandate and transitions state to CAPTURED", async () => {
    const capturePropId = "prop_capture_test_02";
    const captureHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    await db.insert(schema.proposals).values({
      id: capturePropId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "SKU-KEYBOARD-01",
          title: "Keychron K2",
          unit_price_cents: 8499,
          quantity: 1,
          merchant_domain: "keychron.com",
          price_fetched_at: new Date().toISOString(),
          server_price_cents: 8499,
        },
      ],
      totalCents: 8499,
      currency: "USD",
      proposalHash: captureHash,
      state: "BUYER_APPROVED",
      policyVersionId,
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId: capturePropId,
      proposalHash: captureHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: captureHash,
    });

    const gateway = new DevStubGateway();

    // Create the order first
    const orderRes = await executeCreateOrder({
      mandate,
      gateway,
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
    });

    // Simulate buyer approving the order in gateway
    gateway.simulateBuyerApproval(orderRes.orderId);

    // Capture order
    const captureRes = await executeCaptureOrder({
      mandate,
      orderId: orderRes.orderId,
      gateway,
    });

    expect(captureRes.captureId).toBeDefined();
    expect(captureRes.status).toBe("COMPLETED");
    expect(captureRes.source).toBe("dev_stub");

    // Check DB proposal state is CAPTURED
    const updatedProp = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, capturePropId));
    expect(updatedProp[0].state).toBe("CAPTURED");

    // Check that mandate is now consumed
    const mandateRow = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.jti, mandate.jti));
    expect(mandateRow[0].usedAt).not.toBeNull();

    // Replay attack: attempting to capture again with the same consumed mandate MUST fail
    await expect(
      executeCaptureOrder({
        mandate,
        orderId: orderRes.orderId,
        gateway,
      })
    ).rejects.toThrow("MANDATE_ALREADY_USED");
  });

  it("records CAPTURE_FAILED, logs ledger event, and consumes mandate atomically when capture fails (PRD §8.2 step 5)", async () => {
    const failPropId = "prop_capture_fail_" + Math.random().toString(36).slice(2, 9);
    const failHash = "fail_hash_" + Math.random().toString(36).slice(2, 9).padEnd(64, "0");

    await db.insert(schema.proposals).values({
      id: failPropId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "SKU-KEYBOARD-01",
          title: "Keychron K2",
          unit_price_cents: 8499,
          quantity: 1,
          merchant_domain: "keychron.com",
          price_fetched_at: new Date().toISOString(),
          server_price_cents: 8499,
        },
      ],
      totalCents: 8499,
      currency: "USD",
      proposalHash: failHash,
      state: "BUYER_APPROVED",
      policyVersionId,
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId: failPropId,
      proposalHash: failHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: failHash,
    });

    const gateway = new DevStubGateway();

    // 1. Create order
    const orderRes = await executeCreateOrder({
      mandate,
      gateway,
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
    });

    // 2. Simulate buyer decline or risk hold on payment gateway
    gateway.simulateBuyerDecline(orderRes.orderId);

    // 3. Attempt capture
    const captureRes = await executeCaptureOrder({
      mandate,
      orderId: orderRes.orderId,
      gateway,
    });

    expect(captureRes.status).toBe("DECLINED");

    // 4. Assert proposal state is CAPTURE_FAILED
    const [updatedProp] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, failPropId));
    expect(updatedProp.state).toBe("CAPTURE_FAILED");

    // 5. Assert mandate was consumed BEFORE capture (single-use burned on capture attempt)
    const [mandateRow] = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.jti, mandate.jti));
    expect(mandateRow.usedAt).not.toBeNull();

    // 6. Assert attempting to reuse the spent mandate fails with MANDATE_ALREADY_USED
    await expect(
      executeCaptureOrder({
        mandate,
        orderId: orderRes.orderId,
        gateway,
      })
    ).rejects.toThrow("MANDATE_ALREADY_USED");

    // 7. Assert hash-chained ledger event PAYPAL_ORDER_CAPTURE_FAILED was recorded
    const events = await db
      .select()
      .from(schema.ledgerEvents)
      .where(eq(schema.ledgerEvents.workspaceId, wsId));
    const failEvent = events.find((e) => e.type === "PAYPAL_ORDER_CAPTURE_FAILED");
    expect(failEvent).toBeDefined();
    expect(failEvent?.payloadJson).toMatchObject({
      order_id: orderRes.orderId,
      proposal_id: failPropId,
      status: "DECLINED",
    });
  });

  it("refuses to initialize production PayPal gateway when PAYMENT_MODE=dev_stub", () => {
    process.env.PAYMENT_MODE = "dev_stub";
    const gateway = getPaymentGateway();
    expect(gateway).toBeInstanceOf(DevStubGateway);
  });
});
