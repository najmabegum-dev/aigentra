import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { buildProposalFromItems, formatDecisionCard } from "@/rooms/propose/proposalService";
import { evaluate } from "@/rooms/authorize/engine";
import { PolicyRuleDefinition, SpendState } from "@/rooms/authorize/types";
import { appendEvent } from "@/rooms/verify/ledger";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals
 *
 * Creates and evaluates a purchase proposal for the authenticated workspace.
 * Recomputes all item prices and totals on the server (Golden Rule 5).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active workspace session required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items, intent_id: intentId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal must contain at least one item." },
        { status: 400 }
      );
    }

    // 1. Build and recompute proposal on the server
    const { proposal, proposalToEvaluate } = buildProposalFromItems({
      workspaceId,
      items,
      intentId,
    });

    const db = await getDb();

    // 2. Fetch active policy and latest policy version
    const versions = await db
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.workspaceId, workspaceId))
      .orderBy(desc(schema.policyVersions.version));

    let policyVersion: typeof schema.policyVersions.$inferSelect | undefined;
    let policyRules: PolicyRuleDefinition | null = null;

    for (const v of versions) {
      const rules = v.rulesJson as PolicyRuleDefinition;
      if (rules?.status === "ACTIVE") {
        policyVersion = v;
        policyRules = rules;
        break;
      }
    }

    if (!policyVersion && versions.length > 0) {
      policyVersion = versions[0];
      policyRules = versions[0].rulesJson as PolicyRuleDefinition;
    }

    // 3. Fetch workspace kill switch status and spend state
    const workspace = (
      await db
        .select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, workspaceId))
        .limit(1)
    )[0];

    const spendState: SpendState = {
      kill_switch: workspace?.killSwitch ?? false,
      daily_captured_cents: 0,
      daily_reserved_cents: 0,
    };

    // 4. Deterministic policy evaluation (PRD §6.2)
    const evaluation = evaluate(proposalToEvaluate, policyRules, spendState, new Date());

    // 5. Determine initial state based on decision
    let initialState = "PENDING_APPROVAL";
    if (evaluation.decision === "ALLOW") {
      initialState = "APPROVED_POLICY";
    } else if (evaluation.decision === "DENY") {
      initialState = "REJECTED_POLICY";
    }

    proposal.state = initialState;

    const evaluationId = `eval_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // 6. Persist proposal and evaluation in database
    await db.transaction(async (tx) => {
      await tx.insert(schema.proposals).values({
        id: proposal.id,
        workspaceId,
        intentId: intentId || null,
        itemsJson: proposal.items,
        totalCents: proposal.total_cents,
        currency: "USD",
        proposalHash: proposal.proposal_hash,
        state: initialState,
        policyVersionId: policyVersion?.id || null,
      });

      if (policyVersion) {
        await tx.insert(schema.evaluations).values({
          id: evaluationId,
          workspaceId,
          proposalId: proposal.id,
          policyVersionId: policyVersion.id,
          decision: evaluation.decision,
          ruleResultsJson: evaluation.rule_results,
          reasonCodes: evaluation.reason_codes,
        });
      }

      // Append hash-chained ledger event in the same transaction (Golden Rule 8)
      await appendEvent(
        {
          workspaceId,
          entityType: "proposal",
          entityId: proposal.id,
          type: "PROPOSAL_CREATED",
          actor: "agent",
          payload: {
            proposal_id: proposal.id,
            proposal_hash: proposal.proposal_hash,
            total_cents: proposal.total_cents,
            currency: "USD",
            decision: evaluation.decision,
            reason_codes: evaluation.reason_codes,
            state: initialState,
          },
        },
        tx
      );
    });

    // 7. Format structured DecisionCard presentation
    const decisionCard = formatDecisionCard(evaluation, proposal.proposal_hash);

    return NextResponse.json({
      success: true,
      proposal,
      evaluation,
      decisionCard,
    });
  } catch (error) {
    console.error("POST /api/proposals error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create proposal",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/proposals
 *
 * Lists all proposals for the authenticated workspace.
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
    const proposalList = await db.query.proposals.findMany({
      where: eq(schema.proposals.workspaceId, workspaceId),
      orderBy: [desc(schema.proposals.createdAt)],
    });

    return NextResponse.json({
      success: true,
      proposals: proposalList,
    });
  } catch (error) {
    console.error("GET /api/proposals error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list proposals" },
      { status: 500 }
    );
  }
}
