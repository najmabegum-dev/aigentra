import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { createSamplePolicyRules, SAMPLE_POLICY_NAME } from "@/lib/policies";
import { signWorkspaceId, WORKSPACE_COOKIE_NAME } from "@/lib/session";
import { POST as createProposalRoute, GET as listProposalsRoute } from "@/app/api/proposals/route";
import { GET as getProposalByIdRoute } from "@/app/api/proposals/[id]/route";

describe("Proposals API & Policy Decision Flow (PRD §6.4, §10.2)", () => {
  const wsA = "ws_test_prop_a";
  const wsB = "ws_test_prop_b";
  const polA = "pol_prop_a";
  const pvA = "pv_prop_a_v1";

  beforeAll(async () => {
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long-for-hmac";

    // Clean up any stale records from prior runs
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsA));
    await db.delete(schema.evaluations).where(eq(schema.evaluations.workspaceId, wsA));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsA));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsA));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsA));

    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsB));
    await db.delete(schema.evaluations).where(eq(schema.evaluations.workspaceId, wsB));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsB));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsB));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsB));

    // Seed Workspace A
    await db.insert(schema.workspaces).values({
      id: wsA,
    });

    // Seed Workspace B
    await db.insert(schema.workspaces).values({
      id: wsB,
    });

    // Seed Policy for Workspace A ("Home Office Guardrails")
    const rules = createSamplePolicyRules();
    // Ensure generous validity window
    rules.valid_from = new Date(Date.now() - 3600_000).toISOString();
    rules.expires_at = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();

    await db.insert(schema.policies).values({
      id: polA,
      workspaceId: wsA,
    });

    await db.insert(schema.policyVersions).values({
      id: pvA,
      policyId: polA,
      workspaceId: wsA,
      version: 1,
      rulesJson: rules,
    });
  });

  function createRequestWithCookie(
    url: string,
    workspaceId: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    const signedCookie = signWorkspaceId(workspaceId);
    const headers = new Headers(options?.headers);
    headers.set("cookie", `${WORKSPACE_COOKIE_NAME}=${encodeURIComponent(signedCookie)}`);

    return new NextRequest(url, {
      method: options?.method || "GET",
      headers,
      body: options?.body,
    });
  }

  it("evaluates Keychron K2 cart as REQUIRE_APPROVAL (over $50 threshold, under $150 cart max)", async () => {
    const body = {
      items: [{ sku: "SKU-KEYBOARD-01", quantity: 1 }],
    };

    const req = createRequestWithCookie("http://localhost:3000/api/proposals", wsA, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await createProposalRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.total_cents).toBe(8499);
    expect(data.evaluation.decision).toBe("REQUIRE_APPROVAL");
    expect(data.evaluation.reason_codes).toContain("OVER_APPROVAL_THRESHOLD");
    expect(data.proposal.state).toBe("PENDING_APPROVAL");
    expect(data.decisionCard).toBeDefined();
    expect(data.decisionCard.verdict).toBe("REQUIRE_APPROVAL");
  });

  it("evaluates USB-C Cable cart as ALLOW (under $50 threshold)", async () => {
    const body = {
      items: [{ sku: "SKU-CABLE-01", quantity: 1 }],
    };

    const req = createRequestWithCookie("http://localhost:3000/api/proposals", wsA, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await createProposalRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.total_cents).toBe(1999);
    expect(data.evaluation.decision).toBe("ALLOW");
    expect(data.evaluation.reason_codes).toContain("WITHIN_ALL_LIMITS");
    expect(data.proposal.state).toBe("APPROVED_POLICY");
    expect(data.decisionCard.verdict).toBe("ALLOW");
  });

  it("evaluates 4K Monitor cart as DENY (exceeds $150 cart cap and $120 item cap)", async () => {
    const body = {
      items: [{ sku: "SKU-MONITOR-01", quantity: 1 }],
    };

    const req = createRequestWithCookie("http://localhost:3000/api/proposals", wsA, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await createProposalRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.total_cents).toBe(38999);
    expect(data.evaluation.decision).toBe("DENY");
    expect(data.evaluation.reason_codes).toContain("OVER_CART_CAP");
    expect(data.proposal.state).toBe("REJECTED_POLICY");
    expect(data.decisionCard.verdict).toBe("DENY");
  });

  it("retrieves proposal by ID and enforces workspace tenant isolation (Golden Rule 9)", async () => {
    // 1. Create a proposal in Workspace A
    const createReq = createRequestWithCookie("http://localhost:3000/api/proposals", wsA, {
      method: "POST",
      body: JSON.stringify({
        items: [{ sku: "SKU-MOUSE-01", quantity: 1 }],
      }),
    });
    const createRes = await createProposalRoute(createReq);
    const createdData = await createRes.json();
    const proposalId = createdData.proposal.id;
    expect(proposalId).toBeDefined();

    // 2. Fetch proposal with Workspace A session -> 200 OK
    const getReqA = createRequestWithCookie(
      `http://localhost:3000/api/proposals/${proposalId}`,
      wsA
    );
    const getResA = await getProposalByIdRoute(getReqA, { params: { id: proposalId } });
    expect(getResA.status).toBe(200);
    const getDataA = await getResA.json();
    expect(getDataA.proposal.id).toBe(proposalId);
    expect(getDataA.proposal.total_cents).toBe(9999);

    // 3. Attempt to fetch proposal with Workspace B session -> 404 Not Found (IDOR protection)
    const getReqB = createRequestWithCookie(
      `http://localhost:3000/api/proposals/${proposalId}`,
      wsB
    );
    const getResB = await getProposalByIdRoute(getReqB, { params: { id: proposalId } });
    expect(getResB.status).toBe(404);
  });
});
