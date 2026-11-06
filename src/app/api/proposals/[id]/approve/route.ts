import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { issueMandate } from "@/rooms/authorize/mandates";
import { ProposalItem } from "@/rooms/authorize/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/[id]/approve
 * Approves a proposal requiring human approval and issues an Ed25519 Authority Mandate.
 * PRD §6.5 & F5.
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

    // Check that proposal has not already been rejected or expired
    if (proposal.state === "REJECTED" || proposal.state === "EXPIRED" || proposal.state === "SUPERSEDED") {
      return NextResponse.json(
        { success: false, error: `Proposal in state ${proposal.state} cannot be approved.` },
        { status: 400 }
      );
    }

    // 2. Extract unique merchant domains from items
    const items = (proposal.itemsJson || []) as ProposalItem[];
    const merchantDomains = Array.from(
      new Set(items.map((i) => i.merchant_domain || (i as any).merchant).filter(Boolean))
    );

    // 3. Issue Ed25519 HUMAN_APPROVAL Mandate
    const issued = await issueMandate({
      workspaceId,
      proposalId: proposal.id,
      proposalHash: proposal.proposalHash,
      policyVersionId: proposal.policyVersionId || "pv_default",
      amountCents: proposal.totalCents,
      currency: proposal.currency || "USD",
      merchantDomains,
      grant: "HUMAN_APPROVAL",
      ttlSeconds: 900, // 15 minutes
    });

    // 4. Update proposal state to APPROVED
    const updated = await db
      .update(schema.proposals)
      .set({
        state: "APPROVED",
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
        grant: "HUMAN_APPROVAL",
      },
    });
  } catch (error) {
    console.error("Error approving proposal:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error approving proposal" },
      { status: 500 }
    );
  }
}
