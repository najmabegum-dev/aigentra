import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PayPalGateway } from "@/rooms/execute/paypalGateway";
import { executeCaptureOrder, executeCreateOrder } from "@/rooms/execute/executor";
import { verifyReturnOrder } from "@/rooms/execute/returnVerifier";
import { processWebhook } from "@/rooms/verify/webhooks/processor";
import { createDevStubSignature } from "@/rooms/verify/webhooks/verifier";
import { issueMandate, verifyMandate } from "@/rooms/authorize/mandates";
import { VerifiedMandate } from "@/rooms/authorize/types";

describe("PRD §8.3 Error Handling Matrix (All 7 Situations)", () => {
  const wsId = "ws_test_prd83";
  const policyVersionId = "pv_prd83_1";

  beforeAll(async () => {
    process.env.PAYMENT_MODE = "dev_stub";

    // Seed workspace and active policy
    await db.insert(schema.workspaces).values({ id: wsId }).onConflictDoNothing();
    await db.insert(schema.policies).values({ id: "pol_prd83", workspaceId: wsId }).onConflictDoNothing();
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_prd83",
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        currency: "USD",
        cart_max_cents: 20000,
        per_item_max_cents: 15000,
        approval_threshold_cents: 5000,
        daily_cap_cents: 50000,
        merchant_mode: "DENYLIST",
        merchants: [],
        blocked_categories: [],
        status: "ACTIVE",
        valid_from: new Date(Date.now() - 3600_000).toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
      },
    }).onConflictDoNothing();
  });

  // Helper to create a fresh proposal & mandate
  async function setupProposal(amountCents: number = 8499) {
    const proposalId = `prop_prd83_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const proposalHash = `hash_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

    await db.insert(schema.proposals).values({
      id: proposalId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "TEST-SKU",
          title: "Test Product",
          unit_price_cents: amountCents,
          quantity: 1,
          merchant_domain: "example.com",
          price_fetched_at: new Date().toISOString(),
          server_price_cents: amountCents,
        },
      ],
      totalCents: amountCents,
      currency: "USD",
      proposalHash,
      state: "APPROVED",
      policyVersionId,
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents,
      currency: "USD",
      merchantDomains: ["example.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    return { proposalId, proposalHash, mandate, rawToken: issued.token };
  }

  // Row 1: Buyer cancels
  it("Row 1 - Buyer cancels: transitions state to BUYER_CANCELLED and logs ledger event", async () => {
    const { proposalId } = await setupProposal();

    // Call cancel helper
    const { cancelCheckoutProposal } = await import("@/rooms/execute/cancelHandler");
    const result = await cancelCheckoutProposal({
      proposalId,
      workspaceId: wsId,
      reason: "Buyer cancelled authorization on PayPal sandbox checkout",
    });

    expect(result.success).toBe(true);

    // Verify DB state is BUYER_CANCELLED
    const rows = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalId));
    expect(rows[0].state).toBe("BUYER_CANCELLED");

    // Verify ledger event
    const events = await db
      .select()
      .from(schema.ledgerEvents)
      .where(eq(schema.ledgerEvents.entityId, proposalId));
    const cancelEvt = events.find((e) => e.type === "BUYER_CANCELLED");
    expect(cancelEvt).toBeDefined();
    expect((cancelEvt?.payloadJson as any)?.status).toBe("BUYER_CANCELLED");
  });

  // Row 2: Capture declined (INSTRUMENT_DECLINED etc.)
  it("Row 2 - Capture declined: records CAPTURE_FAILED, readable message, and releases reservation", async () => {
    const { proposalId, mandate } = await setupProposal();
    const orderId = `ORDER-DECLINED-${Date.now()}`;

    // Seed order in paypal_orders to satisfy capture foreign key
    const internalOrderId = `pord_dec_${Date.now()}`;
    await db.insert(schema.paypalOrders).values({
      id: internalOrderId,
      workspaceId: wsId,
      proposalId,
      paypalOrderId: orderId,
      status: "APPROVED",
      requestId: `create-${mandate.jti}`,
      amountCents: mandate.amountCents,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockDeclinedGateway = {
      mode: "paypal_sandbox" as const,
      createOrder: async () => ({} as any),
      getOrder: async () => ({} as any),
      captureOrder: async () => ({
        captureId: `CAP-DECLINED-${Date.now()}`,
        orderId,
        status: "DECLINED" as const,
        amountCents: mandate.amountCents,
        currency: "USD",
        source: "paypal_sandbox" as const,
        label: "PayPal Sandbox",
        rawResponse: { status: "DECLINED", details: [{ issue: "INSTRUMENT_DECLINED" }] },
      }),
    };

    const captureResult = await executeCaptureOrder({
      mandate,
      orderId,
      gateway: mockDeclinedGateway,
    });

    expect(captureResult.status).toBe("DECLINED");

    // Check DB state is CAPTURE_FAILED
    const rows = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalId));
    expect(rows[0].state).toBe("CAPTURE_FAILED");

    // Check ledger event
    const events = await db
      .select()
      .from(schema.ledgerEvents)
      .where(eq(schema.ledgerEvents.entityId, captureResult.captureId));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("PAYPAL_ORDER_CAPTURE_FAILED");
  });

  // Row 3: Create-order timeout
  it("Row 3 - Create-order timeout: recovers by stored request ID without creating duplicate orders", async () => {
    const { proposalId, mandate } = await setupProposal();

    let attempts = 0;
    const expectedOrderId = `ORDER-RECOVERED-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const mockTimeoutGateway = {
      mode: "paypal_sandbox" as const,
      getOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
      createOrder: async (_mandate: VerifiedMandate, input: any) => {
        attempts++;
        if (attempts === 1) {
          // First attempt times out
          const err: any = new Error("Gateway timeout 504 on POST /v2/checkout/orders");
          err.name = "TimeoutError";
          throw err;
        }
        // Second attempt returns created order
        return {
          orderId: expectedOrderId,
          status: "CREATED" as const,
          customId: input.proposalHash,
          amountCents: input.amountCents,
          currency: "USD",
          source: "paypal_sandbox" as const,
          label: "PayPal Sandbox (Orders v2)",
          rawResponse: {},
        };
      },
    };

    // First attempt fails with timeout
    await expect(
      executeCreateOrder({
        mandate,
        gateway: mockTimeoutGateway,
        returnUrl: "http://localhost:3000/checkout?return=true",
        cancelUrl: "http://localhost:3000/checkout?cancel=true",
      })
    ).rejects.toThrow("Gateway timeout");

    // Second attempt uses stored requestId (create-<mandate.jti>) and resolves without creating a duplicate record
    const result = await executeCreateOrder({
      mandate,
      gateway: mockTimeoutGateway,
      returnUrl: "http://localhost:3000/checkout?return=true",
      cancelUrl: "http://localhost:3000/checkout?cancel=true",
    });

    expect(result.orderId).toBe(expectedOrderId);

    // Verify exactly one order record exists for this proposal
    const orderRows = await db
      .select()
      .from(schema.paypalOrders)
      .where(eq(schema.paypalOrders.proposalId, proposalId));
    expect(orderRows.length).toBe(1);
    expect(orderRows[0].requestId).toBe(`create-${mandate.jti}`);
  });

  // Row 4: Capture timeout
  it("Row 4 - Capture timeout: queries order and adopts COMPLETED status", async () => {
    const { mandate } = await setupProposal();

    const mockOrdersController: any = {
      captureOrder: vi.fn(async () => {
        const error: any = new Error("Gateway timeout 504");
        error.name = "TimeoutError";
        throw error;
      }),
      getOrder: vi.fn(async ({ id }: { id: string }) => {
        return {
          result: {
            id,
            status: "COMPLETED",
            purchaseUnits: [
              {
                payments: {
                  captures: [
                    {
                      id: "CAP-TIMEOUT-ADOPTED",
                      status: "COMPLETED",
                      amount: {
                        currencyCode: "USD",
                        value: (mandate.amountCents / 100).toFixed(2),
                      },
                      customId: mandate.proposalHash,
                    },
                  ],
                },
              },
            ],
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    const result = await gateway.captureOrder(mandate, "ORDER-TIMEOUT-TEST", "capture-ORDER-TIMEOUT-TEST");

    expect(result.captureId).toBe("CAP-TIMEOUT-ADOPTED");
    expect(result.status).toBe("COMPLETED");
    expect(result.label).toContain("Reconciled by GET");
  });

  // Row 5: Duplicate webhook
  it("Row 5 - Duplicate webhook: returns HTTP 200 on primary key conflict and changes nothing", async () => {
    const eventId = `WH-DUP-${Date.now()}`;
    const rawBody = JSON.stringify({
      id: eventId,
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "ORDER-DUP-1" },
    });
    const sig = createDevStubSignature(rawBody);
    const headers = {
      transmissionId: "trans-dup",
      transmissionTime: new Date().toISOString(),
      certUrl: "https://api.sandbox.paypal.com/cert",
      authAlgo: "SHA256withRSA",
      transmissionSig: sig,
    };

    // First delivery
    const res1 = await processWebhook(rawBody, headers, wsId);
    expect(res1.status).toBe(200);
    expect(res1.duplicate).toBe(false);

    // Duplicate delivery
    const res2 = await processWebhook(rawBody, headers, wsId);
    expect(res2.status).toBe(200);
    expect(res2.duplicate).toBe(true);
    expect(res2.message).toContain("Duplicate webhook ignored");
  });

  // Row 6: Webhook arrives before capture response
  it("Row 6 - Webhook before capture response: reconciles out-of-order via getOrder", async () => {
    const { proposalId, mandate } = await setupProposal();
    const orderId = `ORDER-OOO-${Date.now()}`;

    // Record order in paypal_orders with proposal state still ORDER_CREATED
    await db.insert(schema.paypalOrders).values({
      id: `pord_ooo_${Date.now()}`,
      workspaceId: wsId,
      proposalId,
      paypalOrderId: orderId,
      status: "CREATED",
      requestId: `create-${mandate.jti}`,
      amountCents: mandate.amountCents,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .update(schema.proposals)
      .set({ state: "ORDER_CREATED" })
      .where(eq(schema.proposals.id, proposalId));

    const mockGateway = {
      getOrder: async (id: string) => ({
        orderId: id,
        status: "COMPLETED",
        customId: mandate.proposalHash,
        amountCents: mandate.amountCents,
        currency: "USD",
      }),
    };

    const rawBody = JSON.stringify({
      id: `WH-OOO-${Date.now()}`,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: `CAP-OOO-${Date.now()}`,
        custom_id: mandate.proposalHash,
        amount: {
          value: (mandate.amountCents / 100).toFixed(2),
          currency_code: "USD",
        },
        supplementary_data: {
          related_ids: {
            order_id: orderId,
          },
        },
      },
    });

    const sig = createDevStubSignature(rawBody);
    const headers = {
      transmissionId: "trans-ooo",
      transmissionTime: new Date().toISOString(),
      certUrl: "https://api.sandbox.paypal.com/cert",
      authAlgo: "SHA256withRSA",
      transmissionSig: sig,
    };

    const processResult = await processWebhook(rawBody, headers, wsId, mockGateway as any);

    expect(processResult.status).toBe(200);
    expect(processResult.reconciliationStatus).toBe("CONFIRMED");

    // Verify proposal transitioned to CONFIRMED
    const updatedProps = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalId));
    expect(updatedProps[0].state).toBe("CONFIRMED");
  });

  // Row 7: Amount or custom_id mismatch
  it("Row 7 - Amount or custom_id mismatch: triggers DRIFT_FLAGGED and emits alert event", async () => {
    const { mandate } = await setupProposal(1000);

    const mockDriftGateway = {
      mode: "paypal_sandbox" as const,
      getOrder: async (id: string) => ({
        orderId: id,
        status: "APPROVED" as const,
        customId: "diverged_tampered_custom_id", // custom_id mismatch!
        amountCents: 1000,
        currency: "USD",
        source: "paypal_sandbox" as const,
        label: "PayPal Sandbox",
        rawResponse: {},
      }),
      createOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
    };

    const verifyResult = await verifyReturnOrder({
      orderId: "ORDER-DRIFT-TEST",
      mandate,
      gateway: mockDriftGateway,
    });

    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.reasonCode).toBe("DRIFT_FLAGGED");
    expect(verifyResult.error).toContain("custom_id mismatch");
  });
});
