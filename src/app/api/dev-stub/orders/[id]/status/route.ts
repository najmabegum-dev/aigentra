import { NextRequest, NextResponse } from "next/server";
import { getPaymentGateway } from "@/rooms/execute/executor";
import { DevStubGateway } from "@/rooms/execute/devStub";

export const dynamic = "force-dynamic";

/**
 * POST /api/dev-stub/orders/[id]/status
 * Dev-stub only helper to simulate buyer approval or decline in tests/dev.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id: orderId } = params;
  const body = await request.json().catch(() => ({}));
  const { action } = body; // "approve" | "decline"

  const gateway = getPaymentGateway();
  if (gateway.mode !== "dev_stub") {
    return NextResponse.json(
      { error: "Dev-stub endpoint is disabled in live PayPal mode." },
      { status: 403 }
    );
  }

  const stub = gateway as DevStubGateway;
  if (action === "decline") {
    stub.simulateBuyerDecline(orderId);
  } else {
    stub.simulateBuyerApproval(orderId);
  }

  return NextResponse.json({
    success: true,
    orderId,
    status: action === "decline" ? "DECLINED" : "APPROVED",
  });
}
