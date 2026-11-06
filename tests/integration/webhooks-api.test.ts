import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { workspaces, proposals, mandates, paypalOrders, webhookEvents, policies, policyVersions } from "@/lib/db/schema";
import { POST } from "@/app/api/webhooks/paypal/route";
import { createDevStubSignature } from "@/rooms/verify/webhooks/verifier";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("POST /api/webhooks/paypal Route Integration (PRD §8.2, §8.3, F7)", () => {
  let wsId: string;
  let propId: string;
  let polId: string;
  let pvId: string;
  let orderId: string;
  let propHash: string;

  beforeEach(async () => {
    process.env.PAYMENT_MODE = "dev_stub";

    wsId = "ws_hook_api_" + Math.random().toString(36).slice(2, 9);
    propId = "prop_hook_api_" + Math.random().toString(36).slice(2, 9);
    polId = "pol_hook_api_" + Math.random().toString(36).slice(2, 9);
    pvId = "pv_hook_api_" + Math.random().toString(36).slice(2, 9);
    orderId = "ORDER-API-HOOK-" + Math.random().toString(36).slice(2, 9);
    propHash = crypto.createHash("sha256").update("prop_api_hash_" + Math.random()).digest("hex");

    await db.insert(workspaces).values({ id: wsId }).onConflictDoNothing();

    await db.insert(policies).values({ id: polId, workspaceId: wsId }).onConflictDoNothing();

    await db.insert(policyVersions).values({
      id: pvId,
      policyId: polId,
      workspaceId: wsId,
      version: 1,
      rulesJson: { status: "ACTIVE", currency: "USD", cart_max_cents: 15000 },
    }).onConflictDoNothing();

    await db.insert(proposals).values({
      id: propId,
      workspaceId: wsId,
      totalCents: 5000,
      currency: "USD",
      proposalHash: propHash,
      state: "ORDER_CREATED",
      policyVersionId: pvId,
      itemsJson: [{ sku: "ITEM-1", title: "Item 1", unit_price_cents: 5000, quantity: 1 }],
    }).onConflictDoNothing();

    const jti = "mandate_api_hook_" + Math.random().toString(36).slice(2, 9);
    await db.insert(mandates).values({
      jti,
      workspaceId: wsId,
      proposalId: propId,
      propHash,
      policyVersionId: pvId,
      amountCents: 5000,
      currency: "USD",
      grant: "POLICY_AUTO",
      expiresAt: new Date(Date.now() + 900_000),
    }).onConflictDoNothing();

    await db.insert(paypalOrders).values({
      id: "pord_api_hook_" + Math.random().toString(36).slice(2, 9),
      workspaceId: wsId,
      proposalId: propId,
      paypalOrderId: orderId,
      status: "CREATED",
      requestId: `create-${jti}`,
      amountCents: 5000,
      currency: "USD",
    }).onConflictDoNothing();
  });

  it("returns 400 when transmission signature header is invalid", async () => {
    const raw = JSON.stringify({ id: "WH-BAD-SIG", event_type: "CHECKOUT.ORDER.APPROVED" });
    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "paypal-transmission-sig": "invalid_sig_value",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("verification failed");
  });

  it("returns 200 and reconciles PAYMENT.CAPTURE.COMPLETED confirming proposal funds", async () => {
    const eventId = "WH-CAPT-API-" + Date.now();
    const raw = JSON.stringify({
      id: eventId,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-API-111",
        custom_id: propHash,
        amount: { value: "50.00", currency_code: "USD" },
        supplementary_data: { related_ids: { order_id: orderId } },
      },
    });

    const sig = createDevStubSignature(raw);
    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "paypal-transmission-sig": sig,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.reconciliationStatus).toBe("CONFIRMED");

    // Check DB state updated
    const [updatedProp] = await db.select().from(proposals).where(eq(proposals.id, propId));
    expect(updatedProp.state).toBe("CONFIRMED");

    // Check saved in webhook_events
    const [storedEvt] = await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, eventId));
    expect(storedEvt).toBeDefined();
    expect(storedEvt.verified).toBe(true);
  });
});
