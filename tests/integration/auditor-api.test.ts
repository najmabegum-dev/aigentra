import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auditor/chat/route";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import crypto from "node:crypto";

describe("Auditor Agent API Integration (POST /api/auditor/chat)", () => {
  let testWorkspaceId: string;

  beforeEach(async () => {
    testWorkspaceId = `ws_audit_api_${crypto.randomBytes(6).toString("hex")}`;
    await db.insert(schema.workspaces).values({
      id: testWorkspaceId,
    }).onConflictDoNothing();
  });

  it("returns HTTP 401 when unauthenticated without workspace session", async () => {
    const req = new NextRequest("http://localhost:3000/api/auditor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Audit the ledger" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("processes audit query with workspace header and returns valid response with tool calls", async () => {
    const req = new NextRequest("http://localhost:3000/api/auditor/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": testWorkspaceId,
      },
      body: JSON.stringify({
        prompt: "Summarize all blocked attempts in the last 24 hours",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(["live", "replay"]).toContain(json.mode);
    expect(typeof json.message).toBe("string");
    expect(json.message.length).toBeGreaterThan(10);
    expect(Array.isArray(json.toolCalls)).toBe(true);
    expect(json.toolCalls.length).toBeGreaterThan(0);
    expect(json.toolCalls[0].toolName).toBe("summarize_blocked");
  });

  it("handles ledger query prompt and invokes query_ledger tool", async () => {
    const req = new NextRequest("http://localhost:3000/api/auditor/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": testWorkspaceId,
      },
      body: JSON.stringify({
        prompt: "Check and audit the latest hash-chained ledger events",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.toolCalls.some((tc: any) => tc.toolName === "query_ledger")).toBe(true);
  });
});
