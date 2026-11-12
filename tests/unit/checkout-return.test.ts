import { beforeAll, describe, expect, it } from "vitest";
import { verifyReturnOrder } from "@/rooms/execute/returnVerifier";
import { VerifiedMandate } from "@/rooms/authorize/types";
import { PaymentGateway } from "@/rooms/execute/types";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

describe("Return Verification Handler (PRD §8.2 step 4, §8.3)", () => {
  const wsId = "ws_test_ret_01";

  beforeAll(async () => {
    await db.insert(workspaces).values({ id: wsId }).onConflictDoNothing();
  });

  const dummyMandate = {
    jti: "test-jti-ret",
    workspaceId: wsId,
    proposalId: "prop_test_01",
    proposalHash: "hash_abcdef1234567890",
    policyVersionId: "pv_1",
    amountCents: 1000,
    currency: "USD",
    merchantDomains: ["store.example.com"],
    grant: "HUMAN_APPROVAL",
    expiresAt: new Date(Date.now() + 3600_000),
    issuedAt: new Date(),
    rawToken: "dummy.jwt.token",
  } as unknown as VerifiedMandate;

  it("succeeds when PayPal order amount and custom_id match mandate", async () => {
    const mockGateway: PaymentGateway = {
      mode: "paypal_sandbox",
      getOrder: async (id: string) => ({
        orderId: id,
        status: "APPROVED",
        customId: dummyMandate.proposalHash,
        amountCents: 1000,
        currency: "USD",
        source: "paypal_sandbox",
        label: "PayPal Sandbox",
        rawResponse: {},
      }),
      createOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
    };

    const result = await verifyReturnOrder({
      orderId: "ORDER-123",
      mandate: dummyMandate,
      gateway: mockGateway,
    });

    expect(result.valid).toBe(true);
    expect(result.order?.status).toBe("APPROVED");
    expect(result.order?.amountCents).toBe(1000);
  });

  it("rejects with DRIFT_FLAGGED when order amount does not match mandate (PRD §8.3)", async () => {
    const mockGateway: PaymentGateway = {
      mode: "paypal_sandbox",
      getOrder: async (id: string) => ({
        orderId: id,
        status: "APPROVED",
        customId: dummyMandate.proposalHash,
        amountCents: 5000, // Tampered/drifted amount!
        currency: "USD",
        source: "paypal_sandbox",
        label: "PayPal Sandbox",
        rawResponse: {},
      }),
      createOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
    };

    const result = await verifyReturnOrder({
      orderId: "ORDER-123",
      mandate: dummyMandate,
      gateway: mockGateway,
    });

    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("DRIFT_FLAGGED");
    expect(result.error).toContain("Amount mismatch");
  });

  it("rejects with DRIFT_FLAGGED when custom_id does not match proposal_hash (PRD §8.3)", async () => {
    const mockGateway: PaymentGateway = {
      mode: "paypal_sandbox",
      getOrder: async (id: string) => ({
        orderId: id,
        status: "APPROVED",
        customId: "tampered_wrong_hash",
        amountCents: 1000,
        currency: "USD",
        source: "paypal_sandbox",
        label: "PayPal Sandbox",
        rawResponse: {},
      }),
      createOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
    };

    const result = await verifyReturnOrder({
      orderId: "ORDER-123",
      mandate: dummyMandate,
      gateway: mockGateway,
    });

    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("DRIFT_FLAGGED");
    expect(result.error).toContain("custom_id mismatch");
  });

  it("rejects if order status is not APPROVED or COMPLETED", async () => {
    const mockGateway: PaymentGateway = {
      mode: "paypal_sandbox",
      getOrder: async (id: string) => ({
        orderId: id,
        status: "CREATED", // Buyer did not approve yet
        customId: dummyMandate.proposalHash,
        amountCents: 1000,
        currency: "USD",
        source: "paypal_sandbox",
        label: "PayPal Sandbox",
        rawResponse: {},
      }),
      createOrder: async () => ({} as any),
      captureOrder: async () => ({} as any),
    };

    const result = await verifyReturnOrder({
      orderId: "ORDER-123",
      mandate: dummyMandate,
      gateway: mockGateway,
    });

    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("ORDER_NOT_APPROVED");
  });
});
