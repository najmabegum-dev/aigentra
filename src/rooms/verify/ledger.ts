import { db } from "@/lib/db";
import { ledgerEvents } from "@/lib/db/schema";
import canonicalize from "canonicalize";
import crypto from "crypto";
import { eq, desc, asc } from "drizzle-orm";

export interface AppendEventParams {
  workspaceId: string;
  entityType: string;
  entityId: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
}

export interface LedgerEventData {
  workspaceId: string;
  seq: number;
  entityType: string;
  entityId: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  prevHash: string;
}

export interface VerificationResult {
  valid: boolean;
  brokenAtSeq?: number;
  reason?: string;
  totalEvents: number;
}

/**
 * Pure function: Computes the SHA-256 hash of an event given its prev_hash and canonicalized event content.
 * Formula: sha256(prev_hash + canonicalize(eventData))
 */
export function computeEventHash(data: LedgerEventData): string {
  // Canonical representation ensures byte-identical serialization across environments
  const canonicalPayload = canonicalize({
    workspace_id: data.workspaceId,
    seq: data.seq,
    entity_type: data.entityType,
    entity_id: data.entityId,
    type: data.type,
    actor: data.actor,
    payload: data.payload,
    prev_hash: data.prevHash,
  });

  if (!canonicalPayload) {
    throw new Error("Failed to canonicalize ledger event payload");
  }

  return crypto
    .createHash("sha256")
    .update(data.prevHash + canonicalPayload)
    .digest("hex");
}

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Appends an event to the workspace hash chain.
 * Atomically locks the chain head for the workspace using SELECT ... FOR UPDATE (PRD §7, F8, Golden Rule 8),
 * calculates seq = lastSeq + 1, sets prev_hash = lastEvent.eventHash (or 64 zeros for genesis),
 * computes event_hash = sha256(prev_hash + canonicalize(event)), and inserts the record.
 */
export async function appendEvent(
  params: AppendEventParams,
  externalTx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
  const executeInTransaction = async (tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    // 1. Lock the chain head row for this workspace to serialize concurrent appends
    // In PostgreSQL / PGlite, SELECT ... FOR UPDATE ensures serialization
    const [lastEvent] = await tx
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, params.workspaceId))
      .orderBy(desc(ledgerEvents.seq))
      .limit(1)
      .for("update");

    const seq = lastEvent ? lastEvent.seq + 1 : 1;
    const prevHash = lastEvent ? lastEvent.eventHash : GENESIS_PREV_HASH;

    const eventHash = computeEventHash({
      workspaceId: params.workspaceId,
      seq,
      entityType: params.entityType,
      entityId: params.entityId,
      type: params.type,
      actor: params.actor,
      payload: params.payload,
      prevHash,
    });

    const id = `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const [inserted] = await tx
      .insert(ledgerEvents)
      .values({
        id,
        workspaceId: params.workspaceId,
        seq,
        entityType: params.entityType,
        entityId: params.entityId,
        type: params.type,
        actor: params.actor,
        payloadJson: params.payload,
        prevHash,
        eventHash,
        createdAt: new Date(),
      })
      .returning();

    return inserted;
  };

  if (externalTx) {
    return executeInTransaction(externalTx);
  }

  return db.transaction(async (tx) => {
    return executeInTransaction(tx);
  });
}

/**
 * Verifies the integrity of the ledger chain for a workspace.
 * Recomputes all hashes from genesis to head and verifies strict sequential monotonicity and prev_hash links.
 */
export async function verifyChain(workspaceId: string): Promise<VerificationResult> {
  const events = await db
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.workspaceId, workspaceId))
    .orderBy(asc(ledgerEvents.seq));

  if (events.length === 0) {
    return { valid: true, totalEvents: 0 };
  }

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSeq = i + 1;

    // 1. Check sequence number monotonicity
    if (event.seq !== expectedSeq) {
      return {
        valid: false,
        brokenAtSeq: event.seq,
        reason: `Sequence gap detected: expected ${expectedSeq}, got ${event.seq}`,
        totalEvents: events.length,
      };
    }

    // 2. Check prev_hash linkage
    if (event.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtSeq: event.seq,
        reason: `Previous hash mismatch: expected ${expectedPrevHash}, got ${event.prevHash}`,
        totalEvents: events.length,
      };
    }

    // 3. Recompute SHA-256 hash
    const recomputedHash = computeEventHash({
      workspaceId: event.workspaceId,
      seq: event.seq,
      entityType: event.entityType,
      entityId: event.entityId,
      type: event.type,
      actor: event.actor,
      payload: event.payloadJson as Record<string, unknown>,
      prevHash: event.prevHash,
    });

    if (event.eventHash !== recomputedHash) {
      return {
        valid: false,
        brokenAtSeq: event.seq,
        reason: `Hash mismatch at seq ${event.seq}: stored ${event.eventHash}, recomputed ${recomputedHash}`,
        totalEvents: events.length,
      };
    }

    expectedPrevHash = event.eventHash;
  }

  return {
    valid: true,
    totalEvents: events.length,
  };
}

/**
 * Loads all chain events relevant to an entity or workspace.
 */
export async function getLedgerChainForWorkspace(workspaceId: string) {
  return db
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.workspaceId, workspaceId))
    .orderBy(asc(ledgerEvents.seq));
}
