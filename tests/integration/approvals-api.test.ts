import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { signWorkspaceId, WORKSPACE_COOKIE_NAME } from "@/lib/session";
import { GET as getApprovalsRoute } from "@/app/api/approvals/route";
import { POST as approveRoute } from "@/app/api/proposals/[id]/approve/route";
import { POST as rejectRoute } from "@/app/api/proposals/[id]/reject/route";
import { POST as supersedeRoute } from "@/app/api/proposals/[id]/supersede/route";
import { POST as issueAutoMandateRoute } from "@/app/api/proposals/[id]/mandate/route";
import { verifyMandate } from "@/rooms/authorize/mandates";

describe("Approval Centre & Mandate Lifecycle API (PRD §6.5, F5)", () => {
  const wsId = "ws_test_approval_flow";
  const propReviewId = "prop_approval_review_01";
  const propAutoId = "prop_approval_auto_02";
  const policyVersionId = "pv_approval_test_v1";
  const sampleHash1 = "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
  const sampleHash2 = "aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000";

  beforeAll(async () => {
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long-for-hmac";

    // Clean up past records
    await db.delete(schema.mandates).where(eq(schema.mandates.workspaceId, wsId));
    await db.delete(schema.evaluations).where(eq(schema.evaluations.workspaceId, wsId));
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsId));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsId));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsId));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsId));

    // Seed workspace and policy
    await db.insert(schema.workspaces).values({ id: wsId });
    await db.insert(schema.policies).values({ id: "pol_appr", workspaceId: wsId });
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_appr",
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        approval_threshold_cents: 5000,
        cart_max_cents: 15000,
      },
    });

    // Seed proposal requiring approval ($84.99)
    await db.insert(schema.proposals).values({
      id: propReviewId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "SKU-KEYBOARD-01",
          title: "Keychron K2 Keyboard",
          merchant_domain: "keychron.com",
          unit_price_cents: 8499,
          quantity: 1,
        },
      ],
      totalCents: 8499,
      currency: "USD",
      proposalHash: sampleHash1,
      state: "PENDING_APPROVAL",
      policyVersionId,
    });

    await db.insert(schema.evaluations).values({
      id: "eval_review_01",
      workspaceId: wsId,
      proposalId: propReviewId,
      policyVersionId,
      decision: "REQUIRE_APPROVAL",
      reasonCodes: ["OVER_APPROVAL_THRESHOLD"],
      ruleResultsJson: [],
    });

    // Seed proposal eligible for auto-checkout ($19.99)
    await db.insert(schema.proposals).values({
      id: propAutoId,
      workspaceId: wsId,
      itemsJson: [
        {
          sku: "SKU-CABLE-01",
          title: "Anker USB-C Cable",
          merchant_domain: "anker.com",
          unit_price_cents: 1999,
          quantity: 1,
        },
      ],
      totalCents: 1999,
      currency: "USD",
      proposalHash: sampleHash2,
      state: "APPROVED_POLICY",
      policyVersionId,
    });

    await db.insert(schema.evaluations).values({
      id: "eval_auto_02",
      workspaceId: wsId,
      proposalId: propAutoId,
      policyVersionId,
      decision: "ALLOW",
      reasonCodes: ["WITHIN_ALL_LIMITS"],
      ruleResultsJson: [],
    });
  });

  function createRequest(url: string, method = "GET", body?: any): NextRequest {
    const signedCookie = signWorkspaceId(wsId);
    const headers = new Headers();
    headers.set("cookie", `${WORKSPACE_COOKIE_NAME}=${encodeURIComponent(signedCookie)}`);

    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("lists pending proposals in GET /api/approvals", async () => {
    const req = createRequest("http://localhost:3000/api/approvals");
    const res = await getApprovalsRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);

    const reviewItem = data.items.find((i: any) => i.proposal.id === propReviewId);
    expect(reviewItem).toBeDefined();
    expect(reviewItem.proposal.totalCents).toBe(8499);
    expect(reviewItem.evaluation.decision).toBe("REQUIRE_APPROVAL");
  });

  it("approves a pending proposal and issues a HUMAN_APPROVAL mandate via POST /api/proposals/:id/approve", async () => {
    const req = createRequest(`http://localhost:3000/api/proposals/${propReviewId}/approve`, "POST");
    const res = await approveRoute(req, { params: { id: propReviewId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.state).toBe("APPROVED");
    expect(data.mandate).toBeDefined();
    expect(data.mandate.grant).toBe("HUMAN_APPROVAL");
    expect(data.mandate.token).toBeDefined();

    // Verify cryptographic signature of the issued mandate token
    const verified = await verifyMandate({
      token: data.mandate.token,
      expectedProposalHash: sampleHash1,
    });
    expect(verified.grant).toBe("HUMAN_APPROVAL");
    expect(verified.amountCents).toBe(8499);
    expect(verified.merchantDomains).toContain("keychron.com");
  });

  it("supersedes proposal upon edit and invalidates any active mandate via POST /api/proposals/:id/supersede", async () => {
    const req = createRequest(`http://localhost:3000/api/proposals/${propReviewId}/supersede`, "POST");
    const res = await supersedeRoute(req, { params: { id: propReviewId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.state).toBe("SUPERSEDED");

    // Verify mandate row has usedAt timestamp populated (invalidated)
    const dbMandates = await db
      .select()
      .from(schema.mandates)
      .where(eq(schema.mandates.proposalId, propReviewId));
    expect(dbMandates.length).toBeGreaterThan(0);
    expect(dbMandates[0].usedAt).not.toBeNull();
  });

  it("issues a POLICY_AUTO mandate for ALLOW-outcome proposals via POST /api/proposals/:id/mandate", async () => {
    const req = createRequest(`http://localhost:3000/api/proposals/${propAutoId}/mandate`, "POST");
    const res = await issueAutoMandateRoute(req, { params: { id: propAutoId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.state).toBe("MANDATED");
    expect(data.mandate.grant).toBe("POLICY_AUTO");

    const verified = await verifyMandate({
      token: data.mandate.token,
      expectedProposalHash: sampleHash2,
    });
    expect(verified.grant).toBe("POLICY_AUTO");
    expect(verified.amountCents).toBe(1999);
  });

  it("rejects a proposal via POST /api/proposals/:id/reject", async () => {
    // Seed another proposal to reject
    const rejectPropId = "prop_to_reject_03";
    await db.insert(schema.proposals).values({
      id: rejectPropId,
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 9999,
      currency: "USD",
      proposalHash: "9999999999999999999999999999999999999999999999999999999999999999",
      state: "PENDING_APPROVAL",
      policyVersionId,
    });

    const req = createRequest(`http://localhost:3000/api/proposals/${rejectPropId}/reject`, "POST");
    const res = await rejectRoute(req, { params: { id: rejectPropId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.proposal.state).toBe("REJECTED");
  });
});
