import { describe, expect, it, vi, beforeEach } from "vitest";
import { PayPalVerifier } from "@/rooms/verify/webhooks/paypalVerifier";

describe("PayPalVerifier (PRD §8.2 Step 7, §8.3)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const dummyRawBody = JSON.stringify({
    id: "WH-EVT-12345",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: { id: "CAP-123" },
  });

  const dummyHeaders = {
    transmissionId: "trans-id-999",
    transmissionTime: "2026-11-09T12:00:00Z",
    certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    authAlgo: "SHA256withRSA",
    transmissionSig: "base64sighere==",
  };

  it("returns verified: false when PAYPAL_WEBHOOK_ID is not configured", async () => {
    const verifier = new PayPalVerifier({ webhookId: "" });
    const result = await verifier.verifyWebhook(dummyRawBody, dummyHeaders);
    expect(result.verified).toBe(false);
    expect(result.error).toContain("PAYPAL_WEBHOOK_ID not configured");
  });

  it("returns verified: true when PayPal returns verification_status: SUCCESS", async () => {
    const mockFetch = vi.fn(async (url: string, init?: any) => {
      if (url.includes("/v1/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "fake-access-token", expires_in: 3600 }),
        };
      }
      if (url.includes("/v1/notifications/verify-webhook-signature")) {
        const body = JSON.parse(init.body);
        expect(body.webhook_id).toBe("WH-ID-CONFIGURED");
        expect(body.transmission_id).toBe("trans-id-999");
        expect(body.webhook_event.id).toBe("WH-EVT-12345");
        return {
          ok: true,
          json: async () => ({ verification_status: "SUCCESS" }),
        };
      }
      return { ok: false, status: 404 };
    });

    const verifier = new PayPalVerifier({
      webhookId: "WH-ID-CONFIGURED",
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchFn: mockFetch as any,
    });

    const result = await verifier.verifyWebhook(dummyRawBody, dummyHeaders);
    expect(result.verified).toBe(true);
  });

  it("returns verified: false when PayPal returns verification_status: FAILURE", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "fake-access-token", expires_in: 3600 }),
        };
      }
      return {
        ok: true,
        json: async () => ({ verification_status: "FAILURE" }),
      };
    });

    const verifier = new PayPalVerifier({
      webhookId: "WH-ID-CONFIGURED",
      clientId: "client-id",
      clientSecret: "client-secret",
      fetchFn: mockFetch as any,
    });

    const result = await verifier.verifyWebhook(dummyRawBody, dummyHeaders);
    expect(result.verified).toBe(false);
    expect(result.error).toContain("verification_status FAILURE");
  });
});
