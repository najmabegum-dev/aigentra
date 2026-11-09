import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { verifyMandate } from "@/rooms/authorize/mandates";
import { executeCaptureOrder } from "@/rooms/execute/executor";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/capture-order
 * Captures an approved PayPal order, atomically consuming the single-use mandate.
 * PRD §8.2 step 5, §8.3 Row 2.
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

    // 1. Cryptographically verify mandate
    const verifiedMandate = await verifyMandate({
      token: mandateToken,
    });

    if (verifiedMandate.workspaceId !== workspaceId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Mandate does not belong to active workspace." },
        { status: 403 }
      );
    }

    // 2. Execute capture through the gate (atomically consumes mandate)
    const captureResult = await executeCaptureOrder({
      mandate: verifiedMandate,
      orderId,
    });

    if (captureResult.status === "DECLINED") {
      return NextResponse.json(
        {
          success: false,
          status: "DECLINED",
          capture_id: captureResult.captureId,
          error:
            "Payment declined: Your payment instrument was declined by PayPal (e.g. card declined or insufficient funds). Mandate consumed; a new approval is required.",
        },
        { status: 400 }
      );
    }

    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          status: captureResult.status,
          capture_id: captureResult.captureId,
          error: `Payment capture incomplete: PayPal returned status ${captureResult.status}.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      capture_id: captureResult.captureId,
      status: captureResult.status,
      amount_cents: captureResult.amountCents,
      currency: captureResult.currency,
      source: captureResult.source,
      label: captureResult.label,
    });
  } catch (error: any) {
    console.error("Error capturing checkout order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to capture checkout order" },
      { status: 500 }
    );
  }
}
