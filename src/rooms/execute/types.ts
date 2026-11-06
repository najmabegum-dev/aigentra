import { VerifiedMandate } from "@/rooms/authorize/types";

export interface GatewayOrderItem {
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface GatewayCreateOrderInput {
  proposalId: string;
  proposalHash: string;
  amountCents: number;
  currency: "USD";
  items: GatewayOrderItem[];
  returnUrl: string;
  cancelUrl: string;
  requestId: string;
}

export type GatewayOrderStatus =
  | "CREATED"
  | "APPROVED"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED"
  | "TIMEOUT";

export interface GatewayOrderResult {
  orderId: string;
  status: GatewayOrderStatus;
  approveUrl?: string;
  customId?: string;
  amountCents: number;
  currency: string;
  source: "paypal_sandbox" | "dev_stub";
  label: string;
  rawResponse: unknown;
}

export interface GatewayCaptureResult {
  captureId: string;
  orderId: string;
  status: "COMPLETED" | "DECLINED" | "FAILED" | "PENDING";
  amountCents: number;
  currency: string;
  customId?: string;
  source: "paypal_sandbox" | "dev_stub";
  label: string;
  rawResponse: unknown;
}

export interface PaymentGateway {
  readonly mode: "paypal_sandbox" | "dev_stub";

  createOrder(
    mandate: VerifiedMandate,
    input: GatewayCreateOrderInput
  ): Promise<GatewayOrderResult>;

  getOrder(id: string): Promise<GatewayOrderResult>;

  captureOrder(
    mandate: VerifiedMandate,
    orderId: string,
    requestId: string
  ): Promise<GatewayCaptureResult>;
}
