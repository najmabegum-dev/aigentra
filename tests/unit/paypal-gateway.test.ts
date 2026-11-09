import { describe, expect, it, vi } from "vitest";
import { PayPalGateway } from "@/rooms/execute/paypalGateway";
import { VerifiedMandate } from "@/rooms/authorize/types";
import { GatewayCreateOrderInput } from "@/rooms/execute/types";

describe("PayPalGateway (PRD §8.2, §8.3)", () => {
  const dummyMandate = {
    jti: "test-jti-12345",
    workspaceId: "ws_test_01",
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

  const dummyInput: GatewayCreateOrderInput = {
    proposalId: dummyMandate.proposalId,
    proposalHash: dummyMandate.proposalHash,
    amountCents: 1000,
    currency: "USD",
    items: [
      {
        sku: "ITEM-1",
        name: "Test Product",
        unitPriceCents: 1000,
        quantity: 1,
      },
    ],
    returnUrl: "http://localhost:3000/checkout?return=true",
    cancelUrl: "http://localhost:3000/checkout?cancel=true",
    requestId: "create-test-jti-12345",
  };

  it("creates an order with custom_id = proposalHash and invoice_id = AGX-<proposalId>", async () => {
    let capturedCreatePayload: any = null;
    const mockOrdersController: any = {
      createOrder: vi.fn(async (args: any) => {
        capturedCreatePayload = args;
        return {
          result: {
            id: "ORDER-PP-123",
            status: "CREATED",
            links: [
              {
                rel: "approve",
                href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PP-123",
              },
            ],
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    const result = await gateway.createOrder(dummyMandate, dummyInput);

    expect(result.orderId).toBe("ORDER-PP-123");
    expect(result.status).toBe("CREATED");
    expect(result.source).toBe("paypal_sandbox");
    expect(result.approveUrl).toBe(
      "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PP-123"
    );
    expect(result.customId).toBe(dummyMandate.proposalHash);

    // Verify payload contents
    expect(capturedCreatePayload.paypalRequestId).toBe("create-test-jti-12345");
    const pu = capturedCreatePayload.body.purchaseUnits[0];
    expect(pu.customId).toBe(dummyMandate.proposalHash);
    expect(pu.invoiceId).toBe("AGX-prop_test_01");
    expect(pu.amount.value).toBe("10.00");
    expect(pu.items[0].name).toBe("Test Product");
  });

  it("loads an order via getOrder and maps custom_id and amount", async () => {
    const mockOrdersController: any = {
      getOrder: vi.fn(async ({ id }: { id: string }) => {
        return {
          result: {
            id,
            status: "APPROVED",
            purchaseUnits: [
              {
                customId: dummyMandate.proposalHash,
                invoiceId: "AGX-prop_test_01",
                amount: {
                  currencyCode: "USD",
                  value: "10.00",
                },
              },
            ],
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    const result = await gateway.getOrder("ORDER-PP-123");

    expect(result.orderId).toBe("ORDER-PP-123");
    expect(result.status).toBe("APPROVED");
    expect(result.customId).toBe(dummyMandate.proposalHash);
    expect(result.amountCents).toBe(1000);
    expect(result.source).toBe("paypal_sandbox");
  });

  it("captures an order successfully", async () => {
    const mockOrdersController: any = {
      captureOrder: vi.fn(async ({ id }: any) => {
        return {
          result: {
            id,
            status: "COMPLETED",
            purchaseUnits: [
              {
                payments: {
                  captures: [
                    {
                      id: "CAP-PP-999",
                      status: "COMPLETED",
                      amount: {
                        currencyCode: "USD",
                        value: "10.00",
                      },
                      customId: dummyMandate.proposalHash,
                    },
                  ],
                },
              },
            ],
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    const result = await gateway.captureOrder(
      dummyMandate,
      "ORDER-PP-123",
      "capture-ORDER-PP-123"
    );

    expect(result.captureId).toBe("CAP-PP-999");
    expect(result.orderId).toBe("ORDER-PP-123");
    expect(result.status).toBe("COMPLETED");
    expect(result.amountCents).toBe(1000);
    expect(result.source).toBe("paypal_sandbox");
  });

  it("handles capture timeout with reconcile-by-GET adopting COMPLETED status (PRD §8.3)", async () => {
    const mockOrdersController: any = {
      captureOrder: vi.fn(async () => {
        const error: any = new Error("Gateway timeout 504");
        error.name = "TimeoutError";
        throw error;
      }),
      getOrder: vi.fn(async ({ id }: { id: string }) => {
        return {
          result: {
            id,
            status: "COMPLETED",
            purchaseUnits: [
              {
                payments: {
                  captures: [
                    {
                      id: "CAP-RECONCILED-111",
                      status: "COMPLETED",
                      amount: {
                        currencyCode: "USD",
                        value: "10.00",
                      },
                      customId: dummyMandate.proposalHash,
                    },
                  ],
                },
              },
            ],
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    const result = await gateway.captureOrder(
      dummyMandate,
      "ORDER-PP-123",
      "capture-ORDER-PP-123"
    );

    expect(result.captureId).toBe("CAP-RECONCILED-111");
    expect(result.status).toBe("COMPLETED");
    expect(result.label).toContain("Reconciled by GET");
  });

  it("re-throws error if capture times out and getOrder does not show COMPLETED (PRD §8.3)", async () => {
    const mockOrdersController: any = {
      captureOrder: vi.fn(async () => {
        throw new Error("Network failure");
      }),
      getOrder: vi.fn(async ({ id }: { id: string }) => {
        return {
          result: {
            id,
            status: "APPROVED", // Not completed yet
          },
        };
      }),
    };

    const gateway = new PayPalGateway(mockOrdersController);
    await expect(
      gateway.captureOrder(dummyMandate, "ORDER-PP-123", "capture-ORDER-PP-123")
    ).rejects.toThrow("Network failure");
  });
});
