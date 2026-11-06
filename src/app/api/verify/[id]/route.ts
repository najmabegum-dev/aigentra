import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, or, asc } from "drizzle-orm";
import { verifyChain, getLedgerChainForWorkspace } from "@/rooms/verify/ledger";
import { getMandatePublicKeyPem } from "@/rooms/authorize/mandates";

export const dynamic = "force-dynamic";

/**
 * GET /api/verify/:id
 * Public proof JSON endpoint (PRD §13, F8).
 * Read-only proof of transaction and hash-chain audit trail.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const db = await getDb();

    // 1. Resolve entity to a proposal & workspace
    // Try proposal ID, paypal_order_id, or ledger event ID
    let workspaceId: string | null = null;
    let targetProposal: typeof schema.proposals.$inferSelect | null = null;

    // Search proposals
    const [prop] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, id))
      .limit(1);

    if (prop) {
      targetProposal = prop;
      workspaceId = prop.workspaceId;
    } else {
      // Search paypal orders
      const [order] = await db
        .select()
        .from(schema.paypalOrders)
        .where(
          or(
            eq(schema.paypalOrders.paypalOrderId, id),
            eq(schema.paypalOrders.id, id)
          )
        )
        .limit(1);

      if (order) {
        workspaceId = order.workspaceId;
        const [relatedProp] = await db
          .select()
          .from(schema.proposals)
          .where(eq(schema.proposals.id, order.proposalId))
          .limit(1);
        targetProposal = relatedProp ?? null;
      } else {
        // Search ledger events
        const [evt] = await db
          .select()
          .from(schema.ledgerEvents)
          .where(eq(schema.ledgerEvents.id, id))
          .limit(1);

        if (evt) {
          workspaceId = evt.workspaceId;
          if (evt.entityType === "proposal") {
            const [p] = await db
              .select()
              .from(schema.proposals)
              .where(eq(schema.proposals.id, evt.entityId))
              .limit(1);
            targetProposal = p ?? null;
          }
        }
      }
    }

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Transaction or proof not found" },
        { status: 404 }
      );
    }

    // 2. Run hash-chain verification
    const verification = await verifyChain(workspaceId);

    // 3. Load full chain for this workspace
    const rawEvents = await getLedgerChainForWorkspace(workspaceId);

    // 4. Fetch associated PayPal order and capture (if any)
    let paypalOrderId: string | null = null;
    let captureId: string | null = null;

    if (targetProposal) {
      const [orderRow] = await db
        .select()
        .from(schema.paypalOrders)
        .where(eq(schema.paypalOrders.proposalId, targetProposal.id))
        .limit(1);

      if (orderRow) {
        paypalOrderId = orderRow.paypalOrderId;
        const [captureRow] = await db
          .select()
          .from(schema.paypalCaptures)
          .where(eq(schema.paypalCaptures.orderId, orderRow.id))
          .limit(1);

        if (captureRow) {
          captureId = captureRow.captureId;
        }
      }
    }

    // 5. Get public key for cryptographic signature verification
    const publicKeyPem = await getMandatePublicKeyPem();

    return NextResponse.json({
      ok: true,
      valid: verification.valid,
      totalEvents: verification.totalEvents,
      brokenAtSeq: verification.brokenAtSeq ?? null,
      reason: verification.reason ?? null,
      publicKey: publicKeyPem,
      transaction: targetProposal
        ? {
            proposalId: targetProposal.id,
            proposalHash: targetProposal.proposalHash,
            amountCents: targetProposal.totalCents,
            currency: targetProposal.currency,
            state: targetProposal.state,
            paypalOrderId,
            captureId,
            createdAt: targetProposal.createdAt,
          }
        : null,
      events: rawEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        entityType: e.entityType,
        entityId: e.entityId,
        type: e.type,
        actor: e.actor,
        payload: e.payloadJson,
        prevHash: e.prevHash,
        eventHash: e.eventHash,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/verify/:id error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error fetching verification proof" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/verify/:id/tamper
 * Sandbox-only "Tamper demo" endpoint (PRD F8 / Threat A7).
 * Corrupts or restores one stored ledger event payload in the database.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "toggle"; // "tamper" | "restore" | "toggle"

    const db = await getDb();

    // Find proposal or workspace
    const [prop] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, id))
      .limit(1);

    const workspaceId = prop ? prop.workspaceId : id;

    // Load events for this workspace
    const events = await db
      .select()
      .from(schema.ledgerEvents)
      .where(eq(schema.ledgerEvents.workspaceId, workspaceId))
      .orderBy(asc(schema.ledgerEvents.seq));

    if (events.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No ledger events found for this transaction" },
        { status: 404 }
      );
    }

    // Pick target event: prefer seq 2 or the latest event
    const targetEvent = events.length > 1 ? events[1] : events[0];
    const currentPayload = (targetEvent.payloadJson || {}) as Record<string, unknown>;

    let nextPayload: Record<string, unknown>;
    let tampered = false;

    if (currentPayload.__tampered && (action === "restore" || action === "toggle")) {
      // Restore original payload
      nextPayload = (currentPayload.__originalPayload as Record<string, unknown>) || {
        ...currentPayload,
      };
      delete nextPayload.__tampered;
      delete nextPayload.__originalPayload;
      tampered = false;
    } else {
      // Apply tamper: corrupt total_cents or amount_cents or inject flag
      const originalCopy = { ...currentPayload };
      nextPayload = {
        ...currentPayload,
        __tampered: true,
        __originalPayload: originalCopy,
        amount_cents: 999999,
        tampered_at: new Date().toISOString(),
      };
      tampered = true;
    }

    await db
      .update(schema.ledgerEvents)
      .set({ payloadJson: nextPayload })
      .where(eq(schema.ledgerEvents.id, targetEvent.id));

    // Re-verify immediately to report new status
    const verification = await verifyChain(workspaceId);

    return NextResponse.json({
      ok: true,
      tampered,
      targetEventId: targetEvent.id,
      seq: targetEvent.seq,
      verification,
    });
  } catch (error) {
    console.error("POST /api/verify/:id/tamper error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error performing tamper demo" },
      { status: 500 }
    );
  }
}
