import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { workspaces, proposals, mandates, paypalOrders, webhookEvents, ledgerEvents, policies, policyVersions } from "@/lib/db/schema";
import { processWebhook } from "@/rooms/verify/webhooks/processor";
import { DevStubVerifier, createDevStubSignature } from "@/rooms/verify/webhooks/verifier";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Webhook Inbox & Signature Verification (PRD §8.2, §8.3, F7, Threat A6)", () => {
  let testWorkspaceId: string;
  let testProposalId: string;
  let testPolicyId: string;
  let testPolicyVersionId: string;
  let testProposalHash: string;
  let testJti: string;
  let testOrderId: string;

  beforeEach(async () => {
    testWorkspaceId = "ws_hook_test_" + Math.random().toString(36).slice(2, 9);
    testProposalId = "prop_hook_" + Math.random().toString(36).slice(2, 9);
    testPolicyId = "pol_hook_" + Math.random().toString(36).slice(2, 9);
    testPolicyVersionId = "pv_hook_" + Math.random().toString(36).slice(2, 9);
    testProposalHash = crypto.createHash("sha256").update("canonical_proposal_" + Math.random()).digest("hex");
    testJti = "mandate_" + Math.random().toString(36).slice(2, 9);
    testOrderId = "ORDER-HOOK-" + Math.random().toString(36).slice(2, 9);

    // 1. Seed workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
    }).onConflictDoNothing();

    // 2. Seed policy and version
    await db.insert(policies).values({
      id: testPolicyId,
      workspaceId: testWorkspaceId,
    }).onConflictDoNothing();

    await db.insert(policyVersions).values({
      id: testPolicyVersionId,
      policyId: testPolicyId,
      workspaceId: testWorkspaceId,
      version: 1,
      rulesJson: { status: "ACTIVE", currency: "USD", cart_max_cents: 15000 },
    }).onConflictDoNothing();

    // 3. Seed proposal
    await db.insert(proposals).values({
      id: testProposalId,
      workspaceId: testWorkspaceId,
      totalCents: 8499,
      currency: "USD",
      proposalHash: testProposalHash,
      state: "ORDER_CREATED",
      policyVersionId: testPolicyVersionId,
      itemsJson: [{ sku: "K2-KEYBOARD", title: "Keychron K2", unit_price_cents: 8499, quantity: 1 }],
    }).onConflictDoNothing();

    // 4. Seed mandate
    await db.insert(mandates).values({
      jti: testJti,
      workspaceId: testWorkspaceId,
      proposalId: testProposalId,
      propHash: testProposalHash,
      policyVersionId: testPolicyVersionId,
      amountCents: 8499,
      currency: "USD",
      grant: "POLICY_AUTO",
      expiresAt: new Date(Date.now() + 900_000),
    }).onConflictDoNothing();

    // 5. Seed paypal_orders
    await db.insert(paypalOrders).values({
      id: "pord_hook_test_" + Math.random().toString(36).slice(2, 8),
      workspaceId: testWorkspaceId,
      proposalId: testProposalId,
      paypalOrderId: testOrderId,
      status: "CREATED",
      requestId: `create-${testJti}`,
      amountCents: 8499,
      currency: "USD",
    }).onConflictDoNothing();
  });

  it("rejects invalid webhook signature with HTTP 400 and appends a security ledger event", async () => {
    const rawPayload = JSON.stringify({
      id: "WH-EVT-BAD-" + Date.now(),
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: testOrderId },
    });

    const headers = {
      transmissionId: "trans_bad",
      transmissionTime: new Date().toISOString(),
      transmissionSig: "bad_signature_hex",
    };

    const result = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(result.status).toBe(400);
    expect(result.error).toContain("verification failed");

    // Verify security ledger event was appended
    const secEvents = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, testWorkspaceId));

    const badSigEvent = secEvents.find((e) => e.type === "SECURITY_WEBHOOK_VERIFICATION_FAILED");
    expect(badSigEvent).toBeDefined();
    expect(badSigEvent?.actor).toBe("webhook");
  });

  it("accepts valid webhook signature, inserts into webhook_events and updates state", async () => {
    const eventId = "WH-EVT-VALID-" + Date.now();
    const rawPayload = JSON.stringify({
      id: eventId,
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: testOrderId },
    });

    const sig = createDevStubSignature(rawPayload);
    const headers = {
      transmissionId: "trans_ok",
      transmissionTime: new Date().toISOString(),
      transmissionSig: sig,
    };

    const result = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(result.status).toBe(200);
    expect(result.verified).toBe(true);

    // Verify saved to webhook_events
    const [stored] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.paypalEventId, eventId));

    expect(stored).toBeDefined();
    expect(stored.verified).toBe(true);
    expect(stored.eventType).toBe("CHECKOUT.ORDER.APPROVED");
  });

  it("deduplicates identical webhook events by primary key returning HTTP 200 without duplicate action", async () => {
    const eventId = "WH-EVT-DEDUPE-" + Date.now();
    const rawPayload = JSON.stringify({
      id: eventId,
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: testOrderId },
    });

    const sig = createDevStubSignature(rawPayload);
    const headers = { transmissionSig: sig };

    // 1st receipt
    const firstRes = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(firstRes.status).toBe(200);
    expect(firstRes.duplicate).toBe(false);

    // 2nd receipt (exact same event ID)
    const secondRes = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(secondRes.status).toBe(200);
    expect(secondRes.duplicate).toBe(true);
    expect(secondRes.message).toContain("Duplicate webhook ignored");
  });

  it("confirms funds on PAYMENT.CAPTURE.COMPLETED when amount and custom_id match mandate", async () => {
    const eventId = "WH-EVT-CAPTURE-OK-" + Date.now();
    const rawPayload = JSON.stringify({
      id: eventId,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-OK-123",
        custom_id: testProposalHash,
        amount: {
          value: "84.99",
          currency_code: "USD",
        },
        supplementary_data: {
          related_ids: {
            order_id: testOrderId,
          },
        },
      },
    });

    const sig = createDevStubSignature(rawPayload);
    const headers = { transmissionSig: sig };

    const result = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(result.status).toBe(200);
    expect(result.reconciliationStatus).toBe("CONFIRMED");

    // Verify proposal updated to CONFIRMED
    const [prop] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, testProposalId));

    expect(prop.state).toBe("CONFIRMED");
  });

  it("flags DRIFT_FLAGGED when PAYMENT.CAPTURE.COMPLETED amount or custom_id differs from mandate", async () => {
    const eventId = "WH-EVT-CAPTURE-DRIFT-" + Date.now();
    const rawPayload = JSON.stringify({
      id: eventId,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-DRIFT-456",
        custom_id: "TAMPERED_CUSTOM_ID_NOT_PROPOSAL_HASH",
        amount: {
          value: "199.99", // Drifted amount ($199.99 vs $84.99 authorized)
          currency_code: "USD",
        },
        supplementary_data: {
          related_ids: {
            order_id: testOrderId,
          },
        },
      },
    });

    const sig = createDevStubSignature(rawPayload);
    const headers = { transmissionSig: sig };

    const result = await processWebhook(rawPayload, headers, testWorkspaceId);
    expect(result.status).toBe(200);
    expect(result.reconciliationStatus).toBe("DRIFT_FLAGGED");

    // Verify proposal updated to DRIFT_FLAGGED
    const [prop] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, testProposalId));

    expect(prop.state).toBe("DRIFT_FLAGGED");

    // Check ledger event recorded the drift
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, testWorkspaceId));

    const driftEvt = events.find((e) => e.type === "PAYMENT_DRIFT_FLAGGED");
    expect(driftEvt).toBeDefined();
    expect(driftEvt?.payloadJson).toMatchObject({
      expected_amount_cents: 8499,
      actual_amount_cents: 19999,
    });
  });

  it("reconciles out-of-order webhook via gateway.getOrder when capture webhook arrives before local capture response (PRD §8.3)", async () => {
    // 1. Prepare proposal in BUYER_APPROVED state (capture response not yet processed locally)
    const outOrderPropId = "prop_out_order_" + Math.random().toString(36).slice(2, 9);
    const outOrderHash = crypto.createHash("sha256").update("canonical_out_order_" + Math.random()).digest("hex");
    const outOrderJti = "mandate_ooo_" + Math.random().toString(36).slice(2, 9);
    const outOrderId = "ORDER-OOO-" + Math.random().toString(36).slice(2, 9);

    await db.insert(proposals).values({
      id: outOrderPropId,
      workspaceId: testWorkspaceId,
      totalCents: 8499,
      currency: "USD",
      proposalHash: outOrderHash,
      state: "BUYER_APPROVED",
      policyVersionId: testPolicyVersionId,
      itemsJson: [{ sku: "K2-KEYBOARD", title: "Keychron K2", unit_price_cents: 8499, quantity: 1 }],
    });

    await db.insert(mandates).values({
      jti: outOrderJti,
      workspaceId: testWorkspaceId,
      proposalId: outOrderPropId,
      propHash: outOrderHash,
      policyVersionId: testPolicyVersionId,
      amountCents: 8499,
      currency: "USD",
      grant: "POLICY_AUTO",
      expiresAt: new Date(Date.now() + 900_000),
    });

    await db.insert(paypalOrders).values({
      id: "pord_ooo_" + Math.random().toString(36).slice(2, 8),
      workspaceId: testWorkspaceId,
      proposalId: outOrderPropId,
      paypalOrderId: outOrderId,
      status: "APPROVED",
      requestId: `create-${outOrderJti}`,
      amountCents: 8499,
      currency: "USD",
    });

    // 2. Mock or provide gateway where getOrder returns authoritative PayPal state
    let getOrderCalled = false;
    const mockGateway = {
      mode: "dev_stub" as const,
      createOrder: async () => { throw new Error("not called"); },
      captureOrder: async () => { throw new Error("not called"); },
      getOrder: async (id: string) => {
        if (id === outOrderId) {
          getOrderCalled = true;
          return {
            orderId: outOrderId,
            status: "COMPLETED" as const,
            customId: outOrderHash,
            amountCents: 8499,
            currency: "USD",
            source: "dev_stub" as const,
            label: "dev_stub",
            rawResponse: { id: outOrderId, status: "COMPLETED" },
          };
        }
        throw new Error(`Order not found: ${id}`);
      },
    };

    // 3. Webhook arrives out of order
    const eventId = "WH-EVT-OUT-OF-ORDER-" + Date.now();
    const rawPayload = JSON.stringify({
      id: eventId,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-OOO-789",
        custom_id: outOrderHash,
        amount: {
          value: "84.99",
          currency_code: "USD",
        },
        supplementary_data: {
          related_ids: {
            order_id: outOrderId,
          },
        },
      },
    });

    const sig = createDevStubSignature(rawPayload);
    const headers = { transmissionSig: sig };

    const result = await processWebhook(rawPayload, headers, testWorkspaceId, mockGateway);
    expect(result.status).toBe(200);
    expect(result.reconciliationStatus).toBe("CONFIRMED");
    expect(getOrderCalled).toBe(true);

    // 4. Assert proposal updated to CONFIRMED
    const [prop] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, outOrderPropId));
    expect(prop.state).toBe("CONFIRMED");

    // 5. Assert hash-chained ledger event WEBHOOK_RECONCILED_OUT_OF_ORDER was appended
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, testWorkspaceId));

    const oooEvent = events.find((e) => e.type === "WEBHOOK_RECONCILED_OUT_OF_ORDER");
    expect(oooEvent).toBeDefined();
    expect(oooEvent?.payloadJson).toMatchObject({
      order_id: outOrderId,
      proposal_id: outOrderPropId,
      reconciled_via: "gateway.getOrder",
    });
  });
});
