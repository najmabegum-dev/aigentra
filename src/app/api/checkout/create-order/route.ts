import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { verifyMandate } from "@/rooms/authorize/mandates";
import { executeCreateOrder } from "@/rooms/execute/executor";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/create-order
 * Creates a PayPal order anchored to the proposal hash in custom_id.
 * PRD §8.2 step 2.
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
    const { proposal_id: proposalId, mandate_token: mandateToken } = body;

    if (!proposalId || !mandateToken) {
      return NextResponse.json(
        { success: false, error: "proposal_id and mandate_token are required." },
        { status: 400 }
      );
    }

    // 1. Cryptographically verify mandate (returns branded VerifiedMandate)
    const verifiedMandate = await verifyMandate({
      token: mandateToken,
    });

    if (verifiedMandate.workspaceId !== workspaceId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Mandate does not belong to active workspace." },
        { status: 403 }
      );
    }

    if (verifiedMandate.proposalId !== proposalId) {
      return NextResponse.json(
        { success: false, error: "Mandate is not assigned to this proposal." },
        { status: 400 }
      );
    }

    // 2. Derive base host for return and cancel URLs
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const returnUrl = `${protocol}://${host}/checkout?return=true&proposal_id=${proposalId}`;
    const cancelUrl = `${protocol}://${host}/checkout?cancel=true&proposal_id=${proposalId}`;

    // 3. Execute order creation through the gate
    const orderResult = await executeCreateOrder({
      mandate: verifiedMandate,
      returnUrl,
      cancelUrl,
    });

    return NextResponse.json({
      success: true,
      order_id: orderResult.orderId,
      approve_url: orderResult.approveUrl,
      custom_id: orderResult.customId,
      status: orderResult.status,
      source: orderResult.source,
      label: orderResult.label,
    });
  } catch (error: any) {
    console.error("Error creating checkout order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create checkout order" },
      { status: 500 }
    );
  }
}
