/**
 * THROWAWAY SPIKE - NOT FOR PRODUCTION (PRD §8, P20)
 *
 * Temporary API endpoint for testing @paypal/paypal-server-sdk against PayPal Sandbox.
 * Handles order creation (USD 10.00, intent CAPTURE) and server-side capture.
 * Never logs secrets.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  Environment,
  OrdersController,
  CheckoutPaymentIntent,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getPayPalClient(): { client: Client; ordersController: OrdersController } | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment: Environment.Sandbox,
  });

  const ordersController = new OrdersController(client);
  return { client, ordersController };
}

export async function GET(): Promise<NextResponse> {
  const isConfigured = Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
  );
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  return NextResponse.json({
    spike: "THROWAWAY",
    configured: isConfigured,
    baseUrl,
    mode: "sandbox",
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const { action, orderId } = body;

  const sdk = getPayPalClient();
  if (!sdk) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing PayPal credentials in environment. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local",
      },
      { status: 400 }
    );
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  if (action === "create") {
    const requestId = `create-spike-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    try {
      const response = await sdk.ordersController.createOrder({
        paypalRequestId: requestId,
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: "10.00",
              },
              description: "AIGENTRA Sandbox Spike USD 10.00 (THROWAWAY)",
            },
          ],
          paymentSource: {
            paypal: {
              experienceContext: {
                returnUrl: `${baseUrl}/spike?step=capture`,
                cancelUrl: `${baseUrl}/spike?step=cancel`,
                userAction: PaypalExperienceUserAction.PayNow,
              },
            },
          },
        },
      });

      const order = response.result;
      const approveLink = order.links?.find(
        (link) => link.rel === "payer-action" || link.rel === "approve"
      )?.href;

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        status: order.status,
        approveUrl: approveLink,
        requestId,
      });
    } catch (err: any) {
      console.error("[THROWAWAY SPIKE] Create order failed:", err?.message || err);
      return NextResponse.json(
        {
          ok: false,
          error: err?.message || "Failed to create order on PayPal Sandbox",
          details: err?.result || null,
        },
        { status: 500 }
      );
    }
  }

  if (action === "capture") {
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing orderId for capture" },
        { status: 400 }
      );
    }

    const captureRequestId = `capture-spike-${orderId}-${Date.now()}`;

    try {
      const response = await sdk.ordersController.captureOrder({
        id: orderId,
        paypalRequestId: captureRequestId,
      });

      const result = response.result;
      const captures = result.purchaseUnits?.[0]?.payments?.captures;
      const primaryCapture = captures && captures.length > 0 ? captures[0] : null;

      return NextResponse.json({
        ok: true,
        orderId: result.id,
        status: result.status,
        captureId: primaryCapture?.id || null,
        captureStatus: primaryCapture?.status || result.status,
        amount: primaryCapture?.amount
          ? `${primaryCapture.amount.currencyCode} ${primaryCapture.amount.value}`
          : "USD 10.00",
        raw: result,
      });
    } catch (err: any) {
      console.error("[THROWAWAY SPIKE] Capture order failed:", err?.message || err);
      return NextResponse.json(
        {
          ok: false,
          error: err?.message || "Failed to capture order on PayPal Sandbox",
          details: err?.result || null,
        },
        { status: 500 }
      );
    }
  }

  if (action === "get") {
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing orderId" },
        { status: 400 }
      );
    }

    try {
      const response = await sdk.ordersController.getOrder({ id: orderId });
      return NextResponse.json({
        ok: true,
        orderId: response.result.id,
        status: response.result.status,
        order: response.result,
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          error: err?.message || "Failed to fetch order",
          details: err?.result || null,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: "Unknown action. Expected 'create', 'capture', or 'get'." },
    { status: 400 }
  );
}
