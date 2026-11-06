import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { formatDecisionCard } from "@/rooms/propose/proposalService";
import { EvaluationResult } from "@/rooms/authorize/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/proposals/[id]
 *
 * Retrieves a single proposal by ID for the authenticated workspace (Golden Rule 9 IDOR Protection).
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active workspace session required" },
        { status: 401 }
      );
    }

    const { id } = params;
    const db = await getDb();

    // Query proposal scoped strictly by workspaceId
    const proposal = await db.query.proposals.findFirst({
      where: and(eq(schema.proposals.id, id), eq(schema.proposals.workspaceId, workspaceId)),
    });

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: "Proposal not found or access denied" },
        { status: 404 }
      );
    }

    // Query latest evaluation
    const evaluation = await db.query.evaluations.findFirst({
      where: and(
        eq(schema.evaluations.proposalId, id),
        eq(schema.evaluations.workspaceId, workspaceId)
      ),
      orderBy: [desc(schema.evaluations.createdAt)],
    });

    let decisionCard = null;
    if (evaluation) {
      const evalResult: EvaluationResult = {
        decision: evaluation.decision as "ALLOW" | "REQUIRE_APPROVAL" | "DENY",
        reason_codes: (evaluation.reasonCodes as any[]) || [],
        rule_results: (evaluation.ruleResultsJson as any[]) || [],
      };
      decisionCard = formatDecisionCard(evalResult, proposal.proposalHash, evaluation.createdAt);
    }

    return NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        workspace_id: proposal.workspaceId,
        intent_id: proposal.intentId,
        items: proposal.itemsJson,
        total_cents: proposal.totalCents,
        currency: proposal.currency,
        proposal_hash: proposal.proposalHash,
        state: proposal.state,
        created_at: proposal.createdAt,
      },
      evaluation: evaluation
        ? {
            id: evaluation.id,
            decision: evaluation.decision,
            reason_codes: evaluation.reasonCodes,
            rule_results: evaluation.ruleResultsJson,
            created_at: evaluation.createdAt,
          }
        : null,
      decisionCard,
    });
  } catch (error) {
    console.error("GET /api/proposals/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve proposal" },
      { status: 500 }
    );
  }
}
