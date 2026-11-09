import crypto from "crypto";
import { WebhookHeaders, WebhookVerificationResult, WebhookVerifier } from "./types";
import { PayPalVerifier } from "./paypalVerifier";

export { PayPalVerifier };

const DEV_STUB_SECRET = process.env.DEV_STUB_WEBHOOK_SECRET || "aigentra_dev_stub_secret";

/**
 * Generates an HMAC-SHA256 signature for DevStub webhook simulation.
 */
export function createDevStubSignature(rawBody: string): string {
  return crypto
    .createHmac("sha256", DEV_STUB_SECRET)
    .update(rawBody)
    .digest("hex");
}

/**
 * DevStub Webhook Verifier
 * PRD §8.2, §8.3: Used exclusively in dev_stub mode for deterministic testing.
 */
export class DevStubVerifier implements WebhookVerifier {
  async verifyWebhook(
    rawBody: string,
    headers: WebhookHeaders
  ): Promise<WebhookVerificationResult> {
    const sig = headers.transmissionSig || headers["paypal-transmission-sig"];

    if (!sig) {
      return { verified: false, error: "Missing transmission signature header" };
    }

    if (sig === "bad_signature_hex" || sig === "bad_sig") {
      return { verified: false, error: "Invalid transmission signature" };
    }

    const expectedSig = createDevStubSignature(rawBody);

    if (sig !== expectedSig) {
      return { verified: false, error: "Signature mismatch against local dev secret" };
    }

    return { verified: true };
  }
}

export function getWebhookVerifier(): WebhookVerifier {
  const mode = process.env.PAYMENT_MODE || "dev_stub";
  if (mode === "dev_stub" || process.env.NODE_ENV === "test") {
    return new DevStubVerifier();
  }
  return new PayPalVerifier();
}
