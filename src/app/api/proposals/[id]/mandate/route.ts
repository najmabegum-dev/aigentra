import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { issueMandate } from "@/rooms/authorize/mandates";
import { ProposalItem } from "@/rooms/authorize/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/[id]/mandate
 * Issues a POLICY_AUTO mandate when the user checks out an ALLOW-outcome proposal.
 * PRD §6.5, F5.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: proposalId } = params;
    const db = await getDb();

    // 1. Fetch proposal scoped strictly by workspace
    const proposals = await db
      .select()
      .from(schema.proposals)
      .where(
        and(
          eq(schema.proposals.id, proposalId),
          eq(schema.proposals.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (proposals.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    const proposal = proposals[0];

    // 2. Verify latest evaluation outcome was ALLOW
    const evaluations = await db
      .select()
      .from(schema.evaluations)
      .where(eq(schema.evaluations.proposalId, proposal.id))
      .orderBy(desc(schema.evaluations.createdAt))
      .limit(1);

    const evaluation = evaluations[0];
    if (evaluation?.decision !== "ALLOW" && proposal.state !== "APPROVED_POLICY") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot issue auto mandate: evaluation outcome is "${evaluation?.decision || proposal.state}". Human approval required.`,
        },
        { status: 400 }
      );
    }

    // 3. Extract unique merchant domains from items
    const items = (proposal.itemsJson || []) as ProposalItem[];
    const merchantDomains = Array.from(
      new Set(items.map((i) => i.merchant_domain || (i as any).merchant).filter(Boolean))
    );

    // 4. Issue Ed25519 POLICY_AUTO Mandate
    const issued = await issueMandate({
      workspaceId,
      proposalId: proposal.id,
      proposalHash: proposal.proposalHash,
      policyVersionId: proposal.policyVersionId || "pv_default",
      amountCents: proposal.totalCents,
      currency: proposal.currency || "USD",
      merchantDomains,
      grant: "POLICY_AUTO",
      ttlSeconds: 900, // 15 minutes
    });

    // 5. Update proposal state to MANDATED
    const updated = await db
      .update(schema.proposals)
      .set({
        state: "MANDATED",
        updatedAt: new Date(),
      })
      .where(eq(schema.proposals.id, proposal.id))
      .returning();

    return NextResponse.json({
      success: true,
      proposal: updated[0],
      mandate: {
        jti: issued.jti,
        token: issued.token,
        expiresAt: issued.expiresAt.toISOString(),
        issuedAt: issued.issuedAt.toISOString(),
        grant: "POLICY_AUTO",
      },
    });
  } catch (error) {
    console.error("Error issuing auto mandate:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error issuing auto mandate" },
      { status: 500 }
    );
  }
}
