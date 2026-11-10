import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { issueMandate, verifyMandate } from "@/rooms/authorize/mandates";
import { executeCaptureOrder } from "@/rooms/execute/executor";
import { PaymentGateway, GatewayOrderResult, GatewayCaptureResult } from "@/rooms/execute/types";

describe("Capture Pre-Validation & Proposal Binding (F2)", () => {
  const wsId = "ws_test_capture_preval";
  const policyVersionId = "pv_test_capture_preval_v1";

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
    await db.insert(schema.workspaces).values({ id: wsId, killSwitch: false });
    await db.insert(schema.policies).values({ id: "pol_preval", workspaceId: wsId });
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_preval",
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        currency: "USD",
        cart_max_cents: 20000,
        per_item_max_cents: 15000,
        approval_threshold_cents: 5000,
        daily_cap_cents: 500000,
        merchant_mode: "DENYLIST",
        merchants: [],
        blocked_categories: [],
        status: "ACTIVE",
        valid_from: new Date(Date.now() - 3600_000).toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
      },
    });
  });

  async function createProposalAndMandate(propId: string, amountCents: number = 8499) {
    const proposalHash = `hash_${propId}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await db.insert(schema.proposals).values({
      id: propId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "TEST-SKU",
          merchant_domain: "store.google.com",
          unit_price_cents: amountCents,
          server_price_cents: amountCents,
          quantity: 1,
          category: "electronics",
          price_fetched_at: new Date().toISOString(),
        },
      ],
      totalCents: amountCents,
      currency: "USD",
      proposalHash,
      state: "APPROVED_HUMAN",
      policyVersionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId: propId,
      proposalHash,
      policyVersionId,
      amountCents,
      currency: "USD",
      merchantDomains: ["store.google.com"],
      grant: "HUMAN_APPROVAL",
    });

    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    return { proposalHash, mandate: verified };
  }

  it("rejects with ORDER_NOT_BOUND when paypal_order belongs to a different proposal", async () => {
    // 1. Create Proposal A with Mandate A
    const { mandate: mandateA } = await createProposalAndMandate("prop_bound_A");

    // 2. Create Proposal B and bind an order to Proposal B in paypal_orders
    const { mandate: mandateB } = await createProposalAndMandate("prop_bound_B");
    const orderIdB = `ORDER-BOUND-TO-B-${Date.now()}`;
    await db.insert(schema.paypalOrders).values({
      id: `pord_${Date.now()}`,
      workspaceId: wsId,
      proposalId: "prop_bound_B",
      paypalOrderId: orderIdB,
      status: "APPROVED",
      amountCents: 8499,
      currency: "USD",
      requestId: `req_${Date.now()}`,
    });

    // 3. Attempt to capture orderIdB using mandateA
    await expect(
      executeCaptureOrder({
        mandate: mandateA,
        orderId: orderIdB,
      })
    ).rejects.toThrow(/ORDER_NOT_BOUND/);

    // 4. Assert mandateA was NOT consumed
    const mandateRows = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.jti, mandateA.jti));
    expect(mandateRows[0].usedAt).toBeNull();
  });

  it("rejects with DRIFT_FLAGGED when remote order amount drifts from mandate", async () => {
    const { mandate } = await createProposalAndMandate("prop_drift_amount", 8499);
    const orderId = `ORDER-DRIFT-AMT-${Date.now()}`;

    // Order correctly bound to proposal
    await db.insert(schema.paypalOrders).values({
      id: `pord_${Date.now()}`,
      workspaceId: wsId,
      proposalId: "prop_drift_amount",
      paypalOrderId: orderId,
      status: "APPROVED",
      amountCents: 8499,
      currency: "USD",
      requestId: `req_${Date.now()}`,
    });

    // Mock gateway where PayPal returns drifted amount 9999
    const mockGateway: PaymentGateway = {
      mode: "dev_stub",
      createOrder: async () => ({
        orderId: "dummy",
        status: "CREATED",
        amountCents: 8499,
        currency: "USD",
        source: "dev_stub",
        label: "Dev Stub",
        rawResponse: {},
      }),
      getOrder: async (): Promise<GatewayOrderResult> => ({
        orderId,
        status: "APPROVED",
        amountCents: 9999, // Drifted!
        currency: "USD",
        customId: mandate.proposalHash,
        source: "dev_stub",
        label: "Dev Stub",
        rawResponse: {},
      }),
      captureOrder: async (): Promise<GatewayCaptureResult> => {
        throw new Error("Should not reach captureOrder");
      },
    };

    await expect(
      executeCaptureOrder({
        mandate,
        orderId,
        gateway: mockGateway,
      })
    ).rejects.toThrow(/DRIFT_FLAGGED/);

    // Assert mandate was NOT consumed
    const mandateRows = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.jti, mandate.jti));
    expect(mandateRows[0].usedAt).toBeNull();
  });

  it("rejects with DRIFT_FLAGGED when remote order custom_id does not match proposal hash", async () => {
    const { mandate } = await createProposalAndMandate("prop_wrong_custom", 8499);
    const orderId = `ORDER-WRONG-CUSTOM-${Date.now()}`;

    // Order correctly bound to proposal
    await db.insert(schema.paypalOrders).values({
      id: `pord_${Date.now()}`,
      workspaceId: wsId,
      proposalId: "prop_wrong_custom",
      paypalOrderId: orderId,
      status: "APPROVED",
      amountCents: 8499,
      currency: "USD",
      requestId: `req_${Date.now()}`,
    });

    // Mock gateway where PayPal returns wrong custom_id
    const mockGateway: PaymentGateway = {
      mode: "dev_stub",
      createOrder: async () => ({
        orderId: "dummy",
        status: "CREATED",
        amountCents: 8499,
        currency: "USD",
        source: "dev_stub",
        label: "Dev Stub",
        rawResponse: {},
      }),
      getOrder: async (): Promise<GatewayOrderResult> => ({
        orderId,
        status: "APPROVED",
        amountCents: 8499,
        currency: "USD",
        customId: "tampered_fake_custom_id_123456", // Tampered custom_id
        source: "dev_stub",
        label: "Dev Stub",
        rawResponse: {},
      }),
      captureOrder: async (): Promise<GatewayCaptureResult> => {
        throw new Error("Should not reach captureOrder");
      },
    };

    await expect(
      executeCaptureOrder({
        mandate,
        orderId,
        gateway: mockGateway,
      })
    ).rejects.toThrow(/DRIFT_FLAGGED/);

    // Assert mandate was NOT consumed
    const mandateRows = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.jti, mandate.jti));
    expect(mandateRows[0].usedAt).toBeNull();
  });
});
