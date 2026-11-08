#!/usr/bin/env node
/**
 * THROWAWAY SPIKE - NOT FOR PRODUCTION (PRD §8, P20)
 *
 * Direct PayPal Sandbox verification script using @paypal/paypal-server-sdk.
 * Verifies OAuth credentials, order creation (USD 10.00, intent CAPTURE),
 * approval URL extraction, and server-side capture.
 *
 * Usage:
 *   node scripts/spike-paypal.mjs [create]
 *   node scripts/spike-paypal.mjs capture <orderId>
 */

import {
  Client,
  Environment,
  OrdersController,
  CheckoutPaymentIntent,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Attempt to load .env / .env.local if present without logging
function loadLocalEnv() {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      try {
        const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const idx = trimmed.indexOf("=");
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore errors loading env
      }
    }
  }
}

loadLocalEnv();

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

console.log("============================================================");
console.log(" [THROWAWAY] PayPal Sandbox Spike (PRD §8, P20)");
console.log(" Using @paypal/paypal-server-sdk v2 against PayPal Sandbox");
console.log("============================================================\n");

if (!clientId || !clientSecret) {
  console.error("ERROR: Missing PayPal credentials.");
  console.error("Please ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set in your environment or .env.local.");
  console.error("(Never commit or print secrets)");
  process.exit(1);
}

// Initialize PayPal Server SDK Client in Sandbox environment
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: clientId,
    oAuthClientSecret: clientSecret,
  },
  environment: Environment.Sandbox,
});

const ordersController = new OrdersController(client);

const command = process.argv[2] || "create";

async function run() {
  if (command === "capture") {
    const orderId = process.argv[3];
    if (!orderId) {
      console.error("Usage: node scripts/spike-paypal.mjs capture <orderId>");
      process.exit(1);
    }

    console.log(`[THROWAWAY] Capturing order ${orderId} server-side...`);
    const captureRequestId = `capture-spike-${orderId}-${Date.now()}`;

    try {
      const response = await ordersController.captureOrder({
        id: orderId,
        paypalRequestId: captureRequestId,
      });

      const result = response.result;
      console.log("\n>>> CAPTURE RESPONSE SUCCESS <<<");
      console.log(`Order ID:      ${result.id}`);
      console.log(`Status:        ${result.status}`);

      const captures = result.purchaseUnits?.[0]?.payments?.captures;
      if (captures && captures.length > 0) {
        const cap = captures[0];
        console.log(`Capture ID:    ${cap.id}`);
        console.log(`Amount:        ${cap.amount?.currencyCode} ${cap.amount?.value}`);
        console.log(`Capture Status:${cap.status}`);
      } else {
        console.log(`Details:       Order captured with status ${result.status}`);
      }

      console.log("\n[THROWAWAY] Spike capture completed successfully.");
    } catch (err) {
      console.error("\n[THROWAWAY] Capture failed:");
      console.error(err?.message || err);
      if (err?.result) {
        console.error("Error response details:", JSON.stringify(err.result, null, 2));
      }
      process.exit(1);
    }
  } else {
    // Default: create order
    const requestId = `create-spike-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    console.log(`[THROWAWAY] Generating PayPal Sandbox Order:`);
    console.log(`- Amount:            USD 10.00`);
    console.log(`- Intent:            CAPTURE`);
    console.log(`- PayPal-Request-Id: ${requestId}`);
    console.log(`- Return URL:        ${baseUrl}/spike?step=return`);
    console.log(`- Cancel URL:        ${baseUrl}/spike?step=cancel\n`);

    try {
      const response = await ordersController.createOrder({
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
                returnUrl: `${baseUrl}/spike?step=return`,
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

      console.log(">>> ORDER CREATED SUCCESSFULLY <<<");
      console.log(`Order ID:    ${order.id}`);
      console.log(`Status:      ${order.status}`);
      console.log(`Approve URL: ${approveLink || "N/A"}\n`);

      if (approveLink) {
        console.log("------------------------------------------------------------");
        console.log("ACTION REQUIRED: Approve as Sandbox Buyer");
        console.log("1. Open the Approve URL in your browser:");
        console.log(`   ${approveLink}`);
        console.log("2. Sign in with your PayPal Sandbox Personal account to approve.");
        console.log("3. Once approved, capture the order server-side with:");
        console.log(`   node scripts/spike-paypal.mjs capture ${order.id}`);
        console.log("------------------------------------------------------------");
      }
    } catch (err) {
      console.error("[THROWAWAY] Order creation failed:");
      console.error(err?.message || err);
      if (err?.result) {
        console.error("Error response details:", JSON.stringify(err.result, null, 2));
      }
      process.exit(1);
    }
  }
}

run();
