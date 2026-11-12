import { WebhookHeaders, WebhookVerificationResult, WebhookVerifier } from "./types";

interface PayPalVerifierOptions {
  webhookId?: string;
  clientId?: string;
  clientSecret?: string;
  fetchFn?: typeof fetch;
}

// In-memory token cache (PRD §8.2 step 1)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchFn("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain PayPal OAuth token (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * PayPalVerifier validates webhook signatures with the PayPal Notifications API (PRD §8.2 step 7).
 *
 * Golden Rule 7: Verify PayPal webhooks with the verification API on the raw body before any state change.
 */
export class PayPalVerifier implements WebhookVerifier {
  private webhookId: string;
  private clientId: string;
  private clientSecret: string;
  private fetchFn: typeof fetch;

  constructor(options: PayPalVerifierOptions = {}) {
    this.webhookId = options.webhookId ?? (process.env.PAYPAL_WEBHOOK_ID || "");
    this.clientId = options.clientId ?? (process.env.PAYPAL_CLIENT_ID || "");
    this.clientSecret = options.clientSecret ?? (process.env.PAYPAL_CLIENT_SECRET || "");
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async verifyWebhook(
    rawBody: string,
    headers: WebhookHeaders
  ): Promise<WebhookVerificationResult> {
    if (!this.webhookId) {
      return {
        verified: false,
        error: "PAYPAL_WEBHOOK_ID not configured in environment.",
      };
    }

    const authAlgo = headers.authAlgo || headers["paypal-auth-algo"];
    const certUrl = headers.certUrl || headers["paypal-cert-url"];
    const transmissionId = headers.transmissionId || headers["paypal-transmission-id"];
    const transmissionSig = headers.transmissionSig || headers["paypal-transmission-sig"];
    const transmissionTime = headers.transmissionTime || headers["paypal-transmission-time"];

    if (!transmissionId || !transmissionSig || !certUrl || !authAlgo || !transmissionTime) {
      return {
        verified: false,
        error: "Missing required PayPal transmission verification headers.",
      };
    }

    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(rawBody);
    } catch {
      return {
        verified: false,
        error: "Malformed JSON payload in raw webhook body.",
      };
    }

    try {
      const accessToken = await getAccessToken(this.clientId, this.clientSecret, this.fetchFn);

      const verificationPayload = {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: this.webhookId,
        webhook_event: parsedEvent,
      };

      const response = await this.fetchFn(
        "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verificationPayload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          verified: false,
          error: `PayPal verification API returned HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = (await response.json()) as { verification_status?: string };
      if (result.verification_status === "SUCCESS") {
        return { verified: true };
      }

      return {
        verified: false,
        error: `PayPal rejected webhook signature with verification_status ${result.verification_status || "UNKNOWN"}`,
      };
    } catch (err: any) {
      return {
        verified: false,
        error: err.message || "Failed to communicate with PayPal webhook verification API.",
      };
    }
  }
}
