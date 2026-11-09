import {
  Client,
  Environment,
  OrdersController,
  CheckoutPaymentIntent,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";
import { VerifiedMandate } from "@/rooms/authorize/types";
import {
  GatewayCaptureResult,
  GatewayCreateOrderInput,
  GatewayOrderResult,
  GatewayOrderStatus,
  PaymentGateway,
} from "./types";
import {
  incrementGatewayCallCount,
  getGatewayCallCount,
  resetGatewayCallCount,
} from "@/lib/gatewayCounter";

export { getGatewayCallCount, resetGatewayCallCount };

/**
 * PayPalGateway connects AIGENTRA directly to PayPal Sandbox Orders v2 API.
 * PRD §8.1, §8.2, §8.3.
 *
 * Rules:
 * 1. Only accepts a VerifiedMandate (Golden Rule 2).
 * 2. Injects custom_id = proposal_hash and invoice_id = AGX-<proposal_id>.
 * 3. Converts integer cents to two-decimal strings ONLY at the PayPal boundary.
 * 4. Implements reconcile-by-GET on capture timeout/error (PRD §8.3).
 */
export class PayPalGateway implements PaymentGateway {
  readonly mode = "paypal_sandbox" as const;
  private ordersController: OrdersController;

  constructor(customOrdersController?: OrdersController) {
    if (customOrdersController) {
      this.ordersController = customOrdersController;
      return;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required when PAYMENT_MODE=paypal."
      );
    }

    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment: Environment.Sandbox,
    });

    this.ordersController = new OrdersController(client);
  }

  /**
   * Creates a PayPal Sandbox order anchored to the mandate (PRD §8.2 step 2).
   */
  async createOrder(
    mandate: VerifiedMandate,
    input: GatewayCreateOrderInput
  ): Promise<GatewayOrderResult> {
    incrementGatewayCallCount();

    const formattedAmount = (mandate.amountCents / 100).toFixed(2);
    const invoiceId = `AGX-${mandate.proposalId}`;

    const purchaseUnit: any = {
      amount: {
        currencyCode: "USD",
        value: formattedAmount,
      },
      customId: mandate.proposalHash,
      invoiceId,
    };

    if (input.items && input.items.length > 0) {
      purchaseUnit.amount.breakdown = {
        itemTotal: {
          currencyCode: "USD",
          value: formattedAmount,
        },
      };
      purchaseUnit.items = input.items.map((item) => ({
        name: (item.name || item.sku).slice(0, 127),
        quantity: item.quantity.toString(),
        unitAmount: {
          currencyCode: "USD",
          value: (item.unitPriceCents / 100).toFixed(2),
        },
        sku: item.sku.slice(0, 127),
      }));
    }

    const response = await this.ordersController.createOrder({
      paypalRequestId: input.requestId,
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [purchaseUnit],
        paymentSource: {
          paypal: {
            experienceContext: {
              returnUrl: input.returnUrl,
              cancelUrl: input.cancelUrl,
              userAction: PaypalExperienceUserAction.PayNow,
            },
          },
        },
      },
    });

    const order = response.result;
    const approveUrl = order.links?.find(
      (link) => link.rel === "payer-action" || link.rel === "approve"
    )?.href;

    const mappedStatus = this.mapOrderStatus(order.status);

    return {
      orderId: order.id || "",
      status: mappedStatus,
      approveUrl,
      customId: mandate.proposalHash,
      amountCents: mandate.amountCents,
      currency: "USD",
      source: "paypal_sandbox",
      label: "PayPal Sandbox (Orders v2)",
      rawResponse: order,
    };
  }

  /**
   * Retrieves an order from PayPal (PRD §8.2 step 4 & §8.3).
   */
  async getOrder(id: string): Promise<GatewayOrderResult> {
    incrementGatewayCallCount();

    const response = await this.ordersController.getOrder({ id });
    const order = response.result;
    const pu = order.purchaseUnits?.[0];
    const amountVal = pu?.amount?.value || "0";
    const amountCents = Math.round(parseFloat(amountVal) * 100);
    const approveUrl = order.links?.find(
      (link) => link.rel === "payer-action" || link.rel === "approve"
    )?.href;

    return {
      orderId: order.id || id,
      status: this.mapOrderStatus(order.status),
      approveUrl,
      customId: pu?.customId,
      amountCents,
      currency: pu?.amount?.currencyCode || "USD",
      source: "paypal_sandbox",
      label: "PayPal Sandbox (Orders v2)",
      rawResponse: order,
    };
  }

  /**
   * Captures an authorized PayPal order with reconcile-by-GET on timeout (PRD §8.2 step 5, §8.3).
   */
  async captureOrder(
    mandate: VerifiedMandate,
    orderId: string,
    requestId: string
  ): Promise<GatewayCaptureResult> {
    incrementGatewayCallCount();

    try {
      const response = await this.ordersController.captureOrder({
        id: orderId,
        paypalRequestId: requestId,
      });

      const order = response.result;
      return this.extractCaptureResult(order, mandate, false);
    } catch (err: any) {
      // PRD §8.3 Reconcile-by-GET on timeout or network error:
      // "Query order; if already captured, adopt that result."
      try {
        const checkRes = await this.ordersController.getOrder({ id: orderId });
        const remoteOrder = checkRes.result;
        if (remoteOrder && remoteOrder.status === "COMPLETED") {
          return this.extractCaptureResult(remoteOrder, mandate, true);
        }
      } catch {
        // If GET lookup also fails or order is not COMPLETED, re-throw original error
      }

      throw err;
    }
  }

  private extractCaptureResult(
    order: any,
    mandate: VerifiedMandate,
    reconciled: boolean
  ): GatewayCaptureResult {
    const pu = order.purchaseUnits?.[0];
    const capture = pu?.payments?.captures?.[0];
    const captureId = capture?.id || `CAP-${order.id}`;

    let status: "COMPLETED" | "DECLINED" | "FAILED" | "PENDING" = "FAILED";
    const remoteStatus = capture?.status || order.status;
    if (remoteStatus === "COMPLETED") {
      status = "COMPLETED";
    } else if (remoteStatus === "DECLINED") {
      status = "DECLINED";
    } else if (remoteStatus === "PENDING") {
      status = "PENDING";
    }

    const amountVal = capture?.amount?.value || pu?.amount?.value || (mandate.amountCents / 100).toFixed(2);
    const amountCents = Math.round(parseFloat(amountVal) * 100);
    const currency = capture?.amount?.currencyCode || pu?.amount?.currencyCode || "USD";
    const customId = capture?.customId || pu?.customId || mandate.proposalHash;

    return {
      captureId,
      orderId: order.id || "",
      status,
      amountCents,
      currency,
      customId,
      source: "paypal_sandbox",
      label: reconciled
        ? "PayPal Sandbox (Orders v2) [Reconciled by GET]"
        : "PayPal Sandbox (Orders v2)",
      rawResponse: order,
    };
  }

  private mapOrderStatus(status?: string): GatewayOrderStatus {
    switch (status) {
      case "CREATED":
        return "CREATED";
      case "SAVED":
      case "APPROVED":
        return "APPROVED";
      case "VOIDED":
        return "CANCELLED";
      case "COMPLETED":
        return "COMPLETED";
      case "PAYER_ACTION_REQUIRED":
        return "CREATED";
      default:
        return (status as GatewayOrderStatus) || "CREATED";
    }
  }
}
