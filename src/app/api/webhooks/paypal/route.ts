import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/rooms/verify/webhooks/processor";
import { WebhookHeaders } from "@/rooms/verify/webhooks/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paypal
 * Webhook inbox for PayPal Notifications & Sandbox events (PRD §8.2 steps 6-8, §8.3, F7).
 *
 * Golden Rule 7:
 * Verify PayPal webhooks with the verification API on the RAW body before any state change.
 * Dedupe by event ID. Only PAYMENT.CAPTURE.COMPLETED confirms funds.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read the RAW text body first before any JSON parsing
    const rawBody = await request.text();

    // 2. Extract PayPal transmission headers
    const headers: WebhookHeaders = {
      transmissionId:
        request.headers.get("paypal-transmission-id") ||
        request.headers.get("transmission-id") ||
        undefined,
      transmissionTime:
        request.headers.get("paypal-transmission-time") ||
        request.headers.get("transmission-time") ||
        undefined,
      certUrl:
        request.headers.get("paypal-cert-url") ||
        request.headers.get("cert-url") ||
        undefined,
      authAlgo:
        request.headers.get("paypal-auth-algo") ||
        request.headers.get("auth-algo") ||
        undefined,
      transmissionSig:
        request.headers.get("paypal-transmission-sig") ||
        request.headers.get("x-devstub-signature") ||
        request.headers.get("transmission-sig") ||
        undefined,
      webhookId:
        request.headers.get("paypal-webhook-id") ||
        request.headers.get("webhook-id") ||
        undefined,
    };

    // 3. Process webhook through verification & reconciliation pipeline
    const result = await processWebhook(rawBody, headers);

    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    console.error("POST /api/webhooks/paypal error:", error);
    return NextResponse.json(
      {
        status: 500,
        error: "An unexpected internal server error occurred while processing webhook.",
      },
      { status: 500 }
    );
  }
}
