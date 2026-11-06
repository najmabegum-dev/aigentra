import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { workspaces, ledgerEvents } from "@/lib/db/schema";
import { appendEvent, verifyChain, computeEventHash, type LedgerEventData } from "@/rooms/verify/ledger";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Tamper-Evident Hash-Chained Ledger (PRD §7, F8, Threat A7)", () => {
  const testWorkspaceId = "ws_test_ledger_" + Math.random().toString(36).slice(2, 9);

  beforeEach(async () => {
    await db.insert(workspaces).values({
      id: testWorkspaceId,
    }).onConflictDoNothing();
  });

  it("creates a genesis block with 64 zeros as prev_hash and seq=1", async () => {
    const genesis = await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "workspace",
      entityId: testWorkspaceId,
      type: "WORKSPACE_CREATED",
      actor: "system",
      payload: { name: "Ledger Test Workspace" },
    });

    expect(genesis.seq).toBe(1);
    expect(genesis.prevHash).toBe("0".repeat(64));
    expect(genesis.eventHash).toHaveLength(64);

    const expectedHash = computeEventHash({
      workspaceId: testWorkspaceId,
      seq: 1,
      entityType: "workspace",
      entityId: testWorkspaceId,
      type: "WORKSPACE_CREATED",
      actor: "system",
      payload: { name: "Ledger Test Workspace" },
      prevHash: "0".repeat(64),
    });

    expect(genesis.eventHash).toBe(expectedHash);
  });

  it("chains subsequent events with prev_hash matching previous event_hash and incrementing seq", async () => {
    const event2 = await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "policy",
      entityId: "pol_123",
      type: "POLICY_ACTIVATED",
      actor: "admin",
      payload: { version: 1, name: "Home Office Guardrails" },
    });

    expect(event2.seq).toBe(2);

    const [event1] = await db.select().from(ledgerEvents).where(eq(ledgerEvents.workspaceId, testWorkspaceId)).limit(1);
    expect(event2.prevHash).toBe(event1.eventHash);

    const event3 = await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "proposal",
      entityId: "prop_456",
      type: "PROPOSAL_CREATED",
      actor: "agent",
      payload: { total_cents: 8499, currency: "USD" },
    });

    expect(event3.seq).toBe(3);
    expect(event3.prevHash).toBe(event2.eventHash);
  });

  it("verifies an intact chain as valid", async () => {
    const verification = await verifyChain(testWorkspaceId);
    expect(verification.valid).toBe(true);
    expect(verification.totalEvents).toBeGreaterThanOrEqual(3);
    expect(verification.brokenAtSeq).toBeUndefined();
  });

  it("detects any single-field payload edit as a broken chain at the exact sequence number", async () => {
    // Tamper with event 2's payloadJson
    const [event2] = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, testWorkspaceId))
      .offset(1)
      .limit(1);

    expect(event2).toBeDefined();

    // Modify a single field in payload
    await db
      .update(ledgerEvents)
      .set({
        payloadJson: { ...(event2.payloadJson as object), tampered: true },
      })
      .where(eq(ledgerEvents.id, event2.id));

    const check = await verifyChain(testWorkspaceId);
    expect(check.valid).toBe(false);
    expect(check.brokenAtSeq).toBe(event2.seq);
    expect(check.reason).toContain("Hash mismatch");

    // Restore for subsequent tests
    await db
      .update(ledgerEvents)
      .set({
        payloadJson: event2.payloadJson,
      })
      .where(eq(ledgerEvents.id, event2.id));

    const restoredCheck = await verifyChain(testWorkspaceId);
    expect(restoredCheck.valid).toBe(true);
  });

  it("detects tampering with prev_hash or sequence number", async () => {
    const [lastEvent] = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.workspaceId, testWorkspaceId))
      .orderBy(eq(ledgerEvents.seq, 3))
      .limit(1);

    // Tamper with prevHash
    const originalPrev = lastEvent.prevHash;
    await db
      .update(ledgerEvents)
      .set({ prevHash: "f".repeat(64) })
      .where(eq(ledgerEvents.id, lastEvent.id));

    const check = await verifyChain(testWorkspaceId);
    expect(check.valid).toBe(false);
    expect(check.brokenAtSeq).toBe(lastEvent.seq);

    // Restore
    await db
      .update(ledgerEvents)
      .set({ prevHash: originalPrev })
      .where(eq(ledgerEvents.id, lastEvent.id));
  });

  it("concurrent appends with chain head locking produce a strictly gapless monotonic sequence", async () => {
    const concurrentWs = "ws_concurrent_" + Math.random().toString(36).slice(2, 9);
    await db.insert(workspaces).values({
      id: concurrentWs,
    }).onConflictDoNothing();

    // Fire 6 concurrent append operations
    const promises = Array.from({ length: 6 }).map((_, i) =>
      appendEvent({
        workspaceId: concurrentWs,
        entityType: "test",
        entityId: `entity_${i}`,
        type: `TEST_EVENT_${i}`,
        actor: "system",
        payload: { index: i, timestamp: Date.now() },
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(6);

    const sequences = results.map((r) => r.seq).sort((a, b) => a - b);
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6]);

    const chainCheck = await verifyChain(concurrentWs);
    expect(chainCheck.valid).toBe(true);
    expect(chainCheck.totalEvents).toBe(6);
  });
});
