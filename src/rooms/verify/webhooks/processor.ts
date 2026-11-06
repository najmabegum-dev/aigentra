import crypto from "crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { appendEvent } from "../ledger";
import { WebhookHeaders, WebhookProcessResult } from "./types";
import { getWebhookVerifier } from "./verifier";

/**
 * Pure helper to convert decimal string (e.g. "84.99") to integer cents (8499).
 * Golden Rule 4: Money is integer cents plus ISO currency. Never floats.
 */
function parsePayPalAmountCents(valueStr: string): number {
  const parts = valueStr.trim().split(".");
  const dollars = parseInt(parts[0], 10) || 0;
  const cents = parts[1] ? parseInt(parts[1].padEnd(2, "0").slice(0, 2), 10) : 0;
  return dollars * 100 + cents;
}

/**
 * Processes incoming PayPal webhooks (PRD §8.2 steps 6-8, §8.3, F7).
 *
 * Requirements:
 * 1. Verifies raw body signature before ANY state change.
 * 2. Deduplicates by paypal_event_id primary key (conflict -> HTTP 200, change nothing).
 * 3. On PAYMENT.CAPTURE.COMPLETED, compares amount & custom_id against the mandate:
 *    - Match: marks CONFIRMED.
 *    - Mismatch: marks DRIFT_FLAGGED & emits security alert.
 * 4. Appends hash-chained ledger event for each transition.
 */
export async function processWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  explicitWorkspaceId?: string
): Promise<WebhookProcessResult> {
  const verifier = getWebhookVerifier();

  // 1. Verify signature on the raw body before parsing JSON or touching DB (Golden Rule 7)
  const verification = await verifier.verifyWebhook(rawBody, headers);

  // Extract raw body SHA-256 for audit logging
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  if (!verification.verified) {
    // Verification failed: append security ledger event and reject with 400
    const targetWs = explicitWorkspaceId || "ws_security";

    try {
      await appendEvent({
        workspaceId: targetWs,
        entityType: "security",
        entityId: headers.transmissionId || `sec_${Date.now()}`,
        type: "SECURITY_WEBHOOK_VERIFICATION_FAILED",
        actor: "webhook",
        payload: {
          error: verification.error || "Webhook verification failed",
          transmission_id: headers.transmissionId,
          payload_hash: payloadHash,
        },
      });
    } catch {
      // In case workspace doesn't exist, ignore ledger append failure for 400 response
    }

    return {
      status: 400,
      verified: false,
      error: `Webhook verification failed: ${verification.error || "Invalid signature"}`,
    };
  }

  // 2. Parse JSON event payload
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return {
      status: 400,
      verified: true,
      error: "Malformed JSON webhook payload",
    };
  }

  const eventId = event.id || `evt_${Date.now()}`;
  const eventType = event.event_type || "UNKNOWN";
  const resource = event.resource || {};

  // 3. Resolve associated order & workspace
  const relatedOrderId =
    resource.supplementary_data?.related_ids?.order_id ||
    resource.id ||
    (event.resource_type === "checkout-order" ? resource.id : null);

  let workspaceId = explicitWorkspaceId;
  let orderRow: typeof schema.paypalOrders.$inferSelect | undefined;

  if (relatedOrderId) {
    const orders = await db
      .select()
      .from(schema.paypalOrders)
      .where(eq(schema.paypalOrders.paypalOrderId, relatedOrderId))
      .limit(1);

    if (orders.length > 0) {
      orderRow = orders[0];
      workspaceId = workspaceId || orderRow.workspaceId;
    }
  }

  // 4. Primary-Key Deduplication in webhook_events (PRD §8.3)
  const [inserted] = await db
    .insert(schema.webhookEvents)
    .values({
      paypalEventId: eventId,
      workspaceId: workspaceId || null,
      eventType,
      verified: true,
      receivedAt: new Date(),
      processedAt: new Date(),
      payloadHash,
      payloadJson: event,
    })
    .onConflictDoNothing({ target: schema.webhookEvents.paypalEventId })
    .returning();

  if (!inserted) {
    // Primary key duplicate: return HTTP 200, change nothing
    return {
      status: 200,
      verified: true,
      duplicate: true,
      message: "Duplicate webhook ignored",
      eventId,
    };
  }

  // 5. Handle event types
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    // PRD §8.2 step 6: compare amount and custom_id with the mandate
    const actualCustomId = resource.custom_id;
    const amountValStr = resource.amount?.value || "0.00";
    const actualAmountCents = parsePayPalAmountCents(amountValStr);

    let proposalRow: typeof schema.proposals.$inferSelect | undefined;
    let mandateRow: typeof schema.mandates.$inferSelect | undefined;

    if (orderRow) {
      const props = await db
        .select()
        .from(schema.proposals)
        .where(eq(schema.proposals.id, orderRow.proposalId))
        .limit(1);
      proposalRow = props[0];

      if (proposalRow) {
        const mans = await db
          .select()
          .from(schema.mandates)
          .where(eq(schema.mandates.proposalId, proposalRow.id))
          .limit(1);
        mandateRow = mans[0];
      }
    }

    if (proposalRow && mandateRow) {
      const isCustomIdMatch = actualCustomId === mandateRow.propHash;
      const isAmountMatch = actualAmountCents === mandateRow.amountCents;

      if (!isCustomIdMatch || !isAmountMatch) {
        // Flag DRIFT: custom_id or amount diverged from mandate
        await db
          .update(schema.proposals)
          .set({ state: "DRIFT_FLAGGED", updatedAt: new Date() })
          .where(eq(schema.proposals.id, proposalRow.id));

        await appendEvent({
          workspaceId: proposalRow.workspaceId,
          entityType: "webhook",
          entityId: eventId,
          type: "PAYMENT_DRIFT_FLAGGED",
          actor: "webhook",
          payload: {
            event_id: eventId,
            order_id: relatedOrderId,
            proposal_id: proposalRow.id,
            expected_amount_cents: mandateRow.amountCents,
            actual_amount_cents: actualAmountCents,
            expected_custom_id: mandateRow.propHash,
            actual_custom_id: actualCustomId,
          },
        });

        return {
          status: 200,
          verified: true,
          duplicate: false,
          reconciliationStatus: "DRIFT_FLAGGED",
          eventId,
        };
      }

      // Funds confirmed!
      await db
        .update(schema.proposals)
        .set({ state: "CONFIRMED", updatedAt: new Date() })
        .where(eq(schema.proposals.id, proposalRow.id));

      await appendEvent({
        workspaceId: proposalRow.workspaceId,
        entityType: "webhook",
        entityId: eventId,
        type: "PAYMENT_CONFIRMED",
        actor: "webhook",
        payload: {
          event_id: eventId,
          order_id: relatedOrderId,
          proposal_id: proposalRow.id,
          amount_cents: actualAmountCents,
          currency: resource.amount?.currency_code || "USD",
        },
      });

      return {
        status: 200,
        verified: true,
        duplicate: false,
        reconciliationStatus: "CONFIRMED",
        eventId,
      };
    }
  } else if (eventType === "CHECKOUT.ORDER.APPROVED") {
    // Buyer consented on PayPal
    if (orderRow) {
      await db
        .update(schema.proposals)
        .set({ state: "BUYER_APPROVED", updatedAt: new Date() })
        .where(eq(schema.proposals.id, orderRow.proposalId));

      await appendEvent({
        workspaceId: orderRow.workspaceId,
        entityType: "order",
        entityId: orderRow.paypalOrderId,
        type: "CHECKOUT_ORDER_APPROVED",
        actor: "paypal",
        payload: {
          order_id: orderRow.paypalOrderId,
          proposal_id: orderRow.proposalId,
        },
      });
    }

    return {
      status: 200,
      verified: true,
      duplicate: false,
      reconciliationStatus: "PENDING",
      eventId,
    };
  }

  return {
    status: 200,
    verified: true,
    duplicate: false,
    reconciliationStatus: "RECONCILED",
    eventId,
  };
}
