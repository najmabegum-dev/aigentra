import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { cancelCheckoutProposal } from "@/rooms/execute/cancelHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/cancel
 * Handles buyer checkout cancellation (PRD §8.3 Row 2).
 * Transitions proposal state to BUYER_CANCELLED and logs a ledger event.
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
    const { proposal_id: proposalId, reason } = body;

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "proposal_id is required." },
        { status: 400 }
      );
    }

    const result = await cancelCheckoutProposal({
      proposalId,
      workspaceId,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      state: result.state,
      message: "Checkout cancelled by buyer. Proposal state updated to BUYER_CANCELLED.",
    });
  } catch (error: any) {
    console.error("Error cancelling checkout proposal:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected internal server error occurred while cancelling checkout proposal." },
      { status: 500 }
    );
  }
}
