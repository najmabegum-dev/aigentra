import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/studio-data/route";
import { db } from "@/lib/db";
import { workspaces, ledgerEvents, proposals, evaluations, paypalCaptures, paypalOrders } from "@/lib/db/schema";
import { signWorkspaceId, WORKSPACE_COOKIE_NAME } from "@/lib/session";

describe("GET /api/studio-data API Integration (PRD §10.4, F9)", () => {
  let wsId: string;
  let cookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = "test_session_secret_32_characters_long_min";
    wsId = "ws_studio_" + Math.random().toString(36).slice(2, 9);
    cookie = `${WORKSPACE_COOKIE_NAME}=${signWorkspaceId(wsId)}`;
    await db.insert(workspaces).values({ id: wsId }).onConflictDoNothing();
  });

  it("returns HTTP 401 when unauthenticated without workspace cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/studio-data");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns seeded fallback arrays labelled 'seeded' for fresh workspace with 0 transactions", async () => {
    const req = new NextRequest("http://localhost:3000/api/studio-data", {
      headers: { cookie },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.environment).toBe("Sandbox");
    expect(json.workspaceId).toBe(wsId);

    expect(Array.isArray(json.ledger)).toBe(true);
    expect(Array.isArray(json.proposals)).toBe(true);
    expect(Array.isArray(json.decisions)).toBe(true);
    expect(Array.isArray(json.captures)).toBe(true);

    expect(json.ledger.length).toBeGreaterThan(0);
    expect(json.ledger[0].source).toBe("seeded");
    expect(json.ledger[0].environment).toBe("Sandbox");
  });

  it("returns workspace-scoped live data when transactions exist", async () => {
    // Insert live event
    const evtId = "evt_live_" + Date.now();
    await db.insert(ledgerEvents).values({
      id: evtId,
      workspaceId: wsId,
      seq: 1,
      entityType: "proposal",
      entityId: "prop_live_1",
      type: "PROPOSAL_CREATED",
      actor: "agent",
      payloadJson: { amount: 5000 },
      prevHash: "0".repeat(64),
      eventHash: "hash_live_test_123",
      createdAt: new Date(),
    });

    const req = new NextRequest("http://localhost:3000/api/studio-data", {
      headers: { cookie },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.ledger).toHaveLength(1);
    expect(json.ledger[0].id).toBe(evtId);
    expect(json.ledger[0].source).toBe("live");
    expect(json.ledger[0].environment).toBe("Sandbox");
  });
});
