export interface WebhookHeaders {
  transmissionId?: string;
  transmissionTime?: string;
  certUrl?: string;
  authAlgo?: string;
  transmissionSig?: string;
  webhookId?: string;
  [key: string]: string | undefined;
}

export interface WebhookVerificationResult {
  verified: boolean;
  error?: string;
}

export interface WebhookVerifier {
  verifyWebhook(
    rawBody: string,
    headers: WebhookHeaders
  ): Promise<WebhookVerificationResult>;
}

export interface WebhookGateway {
  getOrder(id: string): Promise<{
    orderId: string;
    status: string;
    customId?: string;
    amountCents: number;
    currency?: string;
    [key: string]: any;
  }>;
}

export interface WebhookProcessResult {
  status: number;
  verified?: boolean;
  duplicate?: boolean;
  reconciliationStatus?: "CONFIRMED" | "DRIFT_FLAGGED" | "PENDING" | "RECONCILED";
  error?: string;
  message?: string;
  eventId?: string;
}
