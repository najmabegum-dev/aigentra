import { VerifiedMandate } from "@/rooms/authorize/types";
import {
  GatewayCaptureResult,
  GatewayCreateOrderInput,
  GatewayOrderResult,
  GatewayOrderStatus,
  PaymentGateway,
} from "./types";

interface SimulatedOrder {
  orderId: string;
  status: GatewayOrderStatus;
  amountCents: number;
  currency: string;
  customId: string;
  approveUrl: string;
  returnUrl: string;
  cancelUrl: string;
  requestId: string;
  createdAt: Date;
}

// In-memory store of simulated DevStub PayPal orders
const simulatedOrdersStore = new Map<string, SimulatedOrder>();

/**
 * DevStubGateway simulates PayPal Orders v2 deterministically.
 * PRD §8 & F6.
 *
 * Golden Rule 10 & Safety Invariant:
 * Selectable ONLY when PAYMENT_MODE === "dev_stub".
 * Every response is prominently labelled "dev_stub".
 */
export class DevStubGateway implements PaymentGateway {
  readonly mode = "dev_stub" as const;

  constructor() {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.PAYMENT_MODE === "dev_stub"
    ) {
      throw new Error(
        "FATAL: DevStubGateway cannot be initialized in production. PAYMENT_MODE must be paypal_sandbox."
      );
    }
  }

  async createOrder(
    mandate: VerifiedMandate,
    input: GatewayCreateOrderInput
  ): Promise<GatewayOrderResult> {
    const orderId = `DEV-ORDER-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const approveUrl = `/dev-stub/buyer-approval?order_id=${orderId}&token=${encodeURIComponent(
      mandate.rawToken
    )}&return_url=${encodeURIComponent(input.returnUrl)}&cancel_url=${encodeURIComponent(
      input.cancelUrl
    )}`;

    const simulated: SimulatedOrder = {
      orderId,
      status: "CREATED",
      amountCents: input.amountCents,
      currency: input.currency,
      customId: input.proposalHash,
      approveUrl,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      requestId: input.requestId,
      createdAt: new Date(),
    };

    simulatedOrdersStore.set(orderId, simulated);

    return {
      orderId,
      status: "CREATED",
      approveUrl,
      customId: input.proposalHash,
      amountCents: input.amountCents,
      currency: input.currency,
      source: "dev_stub",
      label: "dev_stub",
      rawResponse: {
        id: orderId,
        status: "CREATED",
        intent: "CAPTURE",
        custom_id: input.proposalHash,
        links: [
          {
            href: approveUrl,
            rel: "payer-action",
            method: "GET",
          },
        ],
      },
    };
  }

  async getOrder(id: string): Promise<GatewayOrderResult> {
    const order = simulatedOrdersStore.get(id);
    if (!order) {
      throw new Error(`DevStub order not found: ${id}`);
    }

    return {
      orderId: order.orderId,
      status: order.status,
      approveUrl: order.approveUrl,
      customId: order.customId,
      amountCents: order.amountCents,
      currency: order.currency,
      source: "dev_stub",
      label: "dev_stub",
      rawResponse: order,
    };
  }

  async captureOrder(
    mandate: VerifiedMandate,
    orderId: string,
    requestId: string
  ): Promise<GatewayCaptureResult> {
    const order = simulatedOrdersStore.get(orderId);
    if (!order) {
      throw new Error(`DevStub order not found for capture: ${orderId}`);
    }

    if (order.status === "DECLINED") {
      return {
        captureId: `DEV-DECLINE-${crypto.randomUUID().slice(0, 8)}`,
        orderId,
        status: "DECLINED",
        amountCents: order.amountCents,
        currency: order.currency,
        customId: order.customId,
        source: "dev_stub",
        label: "dev_stub",
        rawResponse: { status: "DECLINED", reason: "INSTRUMENT_DECLINED" },
      };
    }

    order.status = "COMPLETED";
    simulatedOrdersStore.set(orderId, order);

    const captureId = `DEV-CAP-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    return {
      captureId,
      orderId,
      status: "COMPLETED",
      amountCents: order.amountCents,
      currency: order.currency,
      customId: order.customId,
      source: "dev_stub",
      label: "dev_stub",
      rawResponse: {
        id: captureId,
        status: "COMPLETED",
        amount: {
          value: (order.amountCents / 100).toFixed(2),
          currency_code: order.currency,
        },
        custom_id: order.customId,
        request_id: requestId,
      },
    };
  }

  /**
   * Test / dev helper: marks a simulated order as APPROVED by the buyer.
   */
  simulateBuyerApproval(orderId: string): void {
    const order = simulatedOrdersStore.get(orderId);
    if (order) {
      order.status = "APPROVED";
      simulatedOrdersStore.set(orderId, order);
    }
  }

  /**
   * Test / dev helper: marks a simulated order as DECLINED.
   */
  simulateBuyerDecline(orderId: string): void {
    const order = simulatedOrdersStore.get(orderId);
    if (order) {
      order.status = "DECLINED";
      simulatedOrdersStore.set(orderId, order);
    }
  }
}
