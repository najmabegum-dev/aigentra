import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { workspaces, proposals, ledgerEvents } from "@/lib/db/schema";
import { appendEvent } from "@/rooms/verify/ledger";
import { GET, POST } from "@/app/api/verify/[id]/route";
import { NextRequest } from "next/server";

describe("Public Verify API & Tamper Demo (PRD §7, F8, Threat A7)", () => {
  const testWorkspaceId = "ws_verify_test_" + Math.random().toString(36).slice(2, 9);
  const testProposalId = "prop_verify_" + Math.random().toString(36).slice(2, 9);

  beforeEach(async () => {
    await db.insert(workspaces).values({
      id: testWorkspaceId,
    }).onConflictDoNothing();

    await db.insert(proposals).values({
      id: testProposalId,
      workspaceId: testWorkspaceId,
      itemsJson: [{ sku: "TEST-SKU", title: "Test Item", unit_price_cents: 8499, quantity: 1 }],
      totalCents: 8499,
      currency: "USD",
      proposalHash: "0".repeat(64),
      state: "APPROVED_POLICY",
    }).onConflictDoNothing();

    // Create 3 ledger events
    await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "workspace",
      entityId: testWorkspaceId,
      type: "WORKSPACE_SEEDED",
      actor: "system",
      payload: { name: "Verify API Test Workspace" },
    });

    await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "proposal",
      entityId: testProposalId,
      type: "PROPOSAL_CREATED",
      actor: "agent",
      payload: { total_cents: 8499, currency: "USD", proposal_id: testProposalId },
    });

    await appendEvent({
      workspaceId: testWorkspaceId,
      entityType: "mandate",
      entityId: "man_123",
      type: "MANDATE_ISSUED",
      actor: "policy_engine",
      payload: { amount_cents: 8499, grant: "POLICY_AUTO" },
    });
  });

  it("GET /api/verify/:id returns intact chain with valid: true, public key, and transaction details", async () => {
    const req = new NextRequest(`http://localhost:3000/api/verify/${testProposalId}`);
    const res = await GET(req, { params: { id: testProposalId } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.totalEvents).toBeGreaterThanOrEqual(3);
    expect(body.brokenAtSeq).toBeNull();
    expect(body.publicKey).toContain("PUBLIC KEY");
    expect(body.transaction).toBeDefined();
    expect(body.transaction.proposalId).toBe(testProposalId);
    expect(body.transaction.amountCents).toBe(8499);
    expect(body.events).toHaveLength(body.totalEvents);
    expect(body.events[0].prevHash).toBe("0".repeat(64));
  });

  it("POST /api/verify/:id tampers with an event and GET detects broken chain", async () => {
    // 1. Run tamper demo
    const tamperReq = new NextRequest(`http://localhost:3000/api/verify/${testProposalId}`, {
      method: "POST",
      body: JSON.stringify({ action: "toggle" }),
    });

    const tamperRes = await POST(tamperReq, { params: { id: testProposalId } });
    expect(tamperRes.status).toBe(200);
    const tamperBody = await tamperRes.json();
    expect(tamperBody.ok).toBe(true);
    expect(tamperBody.tampered).toBe(true);
    expect(tamperBody.verification.valid).toBe(false);
    expect(tamperBody.verification.brokenAtSeq).toBe(tamperBody.seq);

    // 2. Subsequent GET /api/verify/:id returns valid: false and brokenAtSeq
    const verifyReq = new NextRequest(`http://localhost:3000/api/verify/${testProposalId}`);
    const verifyRes = await GET(verifyReq, { params: { id: testProposalId } });
    const verifyBody = await verifyRes.json();

    expect(verifyBody.valid).toBe(false);
    expect(verifyBody.brokenAtSeq).toBe(tamperBody.seq);
    expect(verifyBody.reason).toContain("Hash mismatch");

    // 3. Restore event
    const restoreReq = new NextRequest(`http://localhost:3000/api/verify/${testProposalId}`, {
      method: "POST",
      body: JSON.stringify({ action: "restore" }),
    });
    const restoreRes = await POST(restoreReq, { params: { id: testProposalId } });
    const restoreBody = await restoreRes.json();

    expect(restoreBody.ok).toBe(true);
    expect(restoreBody.tampered).toBe(false);
    expect(restoreBody.verification.valid).toBe(true);
  });
});
