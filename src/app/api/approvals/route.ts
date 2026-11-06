import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { PolicyRuleDefinition } from "@/rooms/authorize/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals
 * Lists proposals in the Approval Centre queue for the active workspace.
 * Scoped strictly by workspace_id (Golden Rule 9).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active workspace session required" },
        { status: 401 }
      );
    }

    const db = await getDb();

    // Fetch proposals for this workspace
    const proposalsList = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.workspaceId, workspaceId))
      .orderBy(desc(schema.proposals.createdAt));

    // Fetch latest evaluations, policy versions, and mandates for these proposals
    const results = [];

    for (const proposal of proposalsList) {
      const evaluations = await db
        .select()
        .from(schema.evaluations)
        .where(eq(schema.evaluations.proposalId, proposal.id))
        .orderBy(desc(schema.evaluations.createdAt))
        .limit(1);

      const latestEvaluation = evaluations[0];

      // We surface proposals in the Approval Centre if they require human review
      // or are actively in approved / mandated states
      const needsReview =
        latestEvaluation?.decision === "REQUIRE_APPROVAL" ||
        proposal.state === "PENDING_APPROVAL" ||
        proposal.state === "EVALUATED" ||
        proposal.state === "APPROVED" ||
        proposal.state === "MANDATED";

      if (!needsReview) {
        continue;
      }

      // Fetch policy version rules for side-by-side comparison
      let policyRules: PolicyRuleDefinition | null = null;
      if (proposal.policyVersionId) {
        const pvs = await db
          .select()
          .from(schema.policyVersions)
          .where(eq(schema.policyVersions.id, proposal.policyVersionId))
          .limit(1);
        if (pvs.length > 0) {
          policyRules = pvs[0].rulesJson as PolicyRuleDefinition;
        }
      }

      // Fetch latest mandate if issued
      const mandatesList = await db
        .select()
        .from(schema.mandates)
        .where(eq(schema.mandates.proposalId, proposal.id))
        .orderBy(desc(schema.mandates.createdAt))
        .limit(1);

      results.push({
        proposal,
        evaluation: latestEvaluation
          ? {
              decision: latestEvaluation.decision,
              reason_codes: latestEvaluation.reasonCodes,
              rule_results: latestEvaluation.ruleResultsJson,
            }
          : null,
        policyRules,
        mandate: mandatesList[0] || null,
      });
    }

    return NextResponse.json({
      success: true,
      items: results,
    });
  } catch (error) {
    console.error("Error fetching approvals queue:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching approvals" },
      { status: 500 }
    );
  }
}
