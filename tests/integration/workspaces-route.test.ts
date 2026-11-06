import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/workspaces/route";
import { SAMPLE_POLICY_NAME } from "@/lib/policies";
import { closeDb } from "@/lib/db";

describe("Workspaces Route Integration (POST /api/workspaces)", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("provisions a new workspace through the HTTP route and returns 200", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
    });

    const res = await POST(postReq);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.workspace).toBeDefined();
    expect(body.workspace.id).toMatch(/^ws_[a-f0-9]{16}$/);

    expect(body.policy).toBeDefined();
    expect(body.policy.name).toBe(SAMPLE_POLICY_NAME);
    expect(body.policy.rules.cart_max_cents).toBe(15000);
    expect(body.policy.rules.approval_threshold_cents).toBe(5000);

    // Verify signed cookie was attached
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain("aigentra_workspace=");

    // Verify GET /api/workspaces with the signed cookie resolves the workspace
    const cookieValue = setCookieHeader?.split(";")[0] ?? "";
    const getReq = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "GET",
      headers: {
        cookie: cookieValue,
      },
    });

    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);

    const getBody = await getRes.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.workspace.id).toBe(body.workspace.id);
  });
});
