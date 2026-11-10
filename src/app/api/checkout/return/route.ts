import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { verifyMandate } from "@/rooms/authorize/mandates";
import { verifyReturnOrder } from "@/rooms/execute/returnVerifier";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/return
 * Validates PayPal order upon buyer return against the approved Mandate (PRD §8.2 step 4 & §8.3).
 * Confirms status APPROVED and checks that amount and custom_id match the mandate.
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
    const { order_id: orderId, mandate_token: mandateToken } = body;

    if (!orderId || !mandateToken) {
      return NextResponse.json(
        { success: false, error: "order_id and mandate_token are required." },
        { status: 400 }
      );
    }

    // 1. Verify cryptographic mandate
    const verifiedMandate = await verifyMandate({
      token: mandateToken,
    });

    if (verifiedMandate.workspaceId !== workspaceId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Mandate does not belong to active workspace." },
        { status: 403 }
      );
    }

    // 2. Verify order on PayPal against mandate
    const verification = await verifyReturnOrder({
      orderId,
      mandate: verifiedMandate,
    });

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          reason_code: verification.reasonCode,
          error: verification.error,
          order: verification.order,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      order: verification.order,
    });
  } catch (error: any) {
    console.error("Error in checkout return handler:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected internal server error occurred while verifying return order." },
      { status: 500 }
    );
  }
}
