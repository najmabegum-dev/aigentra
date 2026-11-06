import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { appendEvent } from "@/rooms/verify/ledger";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/[id]/supersede
 * Marks a proposal as SUPERSEDED upon edit and invalidates any existing mandate.
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

    // Invalidate any active mandates for this proposal
    await db
      .update(schema.mandates)
      .set({ usedAt: new Date() })
      .where(eq(schema.mandates.proposalId, proposal.id));

    // Update state to SUPERSEDED
    const updated = await db
      .update(schema.proposals)
      .set({
        state: "SUPERSEDED",
        updatedAt: new Date(),
      })
      .where(eq(schema.proposals.id, proposal.id))
      .returning();

    // Append hash-chained ledger event (Golden Rule 8)
    await appendEvent({
      workspaceId,
      entityType: "proposal",
      entityId: proposal.id,
      type: "PROPOSAL_SUPERSEDED",
      actor: "human",
      payload: {
        proposal_id: proposal.id,
        state: "SUPERSEDED",
      },
    });

    return NextResponse.json({
      success: true,
      proposal: updated[0],
    });
  } catch (error) {
    console.error("Error superseding proposal:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error superseding proposal" },
      { status: 500 }
    );
  }
}
