# AIGENTRA — APIMatic Integration & API Validation Dossier

> **"Bridging Developer Contracts and Autonomous Financial Execution with APIMatic"**

This document details the usage, integration, and developer workflow powered by **APIMatic** in building AIGENTRA for the PayPal AI Hackathon 2026.

---

## 🏛️ Executive Summary

In autonomous agentic commerce, an AI cannot be allowed to hallucinate payment payloads or invent schema parameters. Integration with the PayPal Developer Platform requires mathematically exact payload formatting, strict request headers, and deterministic error handling.

We utilized **APIMatic** to validate, transform, and verify the API surface of PayPal's REST APIs:
1. **PayPal Orders v2 API Contract Validation**: Validating exact payload shapes (`intent: "CAPTURE"`, `purchase_units`, `custom_id`, `invoice_id`).
2. **PayPal Webhooks API Model Conformance**: Structuring raw-body signature verification against `/v1/notifications/verify-webhook-signature`.
3. **APIMatic PayPal Context Plugin**: Guiding the AI coding agent during the design and implementation of `src/rooms/execute/paypalGateway.ts` and `src/rooms/verify/webhooks/paypalVerifier.ts`.

---

## 🛠️ How APIMatic Was Used in AIGENTRA

### 1. API Contract Verification: Orders v2 (`/v2/checkout/orders`)
- **Problem**: In agentic shopping, runtime drift between an AI proposal and the payment gateway can result in silent failures or misbilled transactions.
- **APIMatic Solution**: APIMatic's OpenAPI/JSON-Schema tooling was used to inspect and validate the PayPal Orders v2 specification.
- **Implementation**:
  - Validated that `purchase_units[0].custom_id` allows up to 127 ASCII characters—perfect for anchoring our **RFC 8785 canonical proposal hash** (`proposal_hash`).
  - Confirmed `invoice_id` formatting (`AGX-<proposalId>`) for merchant-side ledger correlation.
  - Verified `PayPal-Request-Id` idempotency header behavior to prevent double-charging on network retry (PRD §8.3 Row 3).

**Code Anchor**:
See [`src/rooms/execute/paypalGateway.ts`](../src/rooms/execute/paypalGateway.ts):
```typescript
const orderRequest = {
  intent: "CAPTURE",
  purchaseUnits: [
    {
      customId: mandate.proposal_hash,      // Validated via APIMatic schema
      invoiceId: `AGX-${mandate.proposal_id}`, // Correlation anchor
      amount: {
        currencyCode: mandate.currency,
        value: (mandate.amount_cents / 100).toFixed(2),
      },
    },
  ],
};
```

---

### 2. Webhook Signature Verification Model (`/v1/notifications/verify-webhook-signature`)
- **Problem**: Webhook verification requires matching 5 distinct transmission headers (`paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`) plus `webhook_id` and the exact unparsed JSON webhook payload. Any discrepancy returns `400 Bad Request`.
- **APIMatic Solution**: Using APIMatic's API modeling, we extracted the required request contract and built our zero-drift `PayPalVerifier`.
- **Implementation**:
  - Validated that `auth_algo` must specify the signature algorithm (e.g., `SHA256withRSA`).
  - Implemented client credentials OAuth token caching with APIMatic's recommended header injection.

**Code Anchor**:
See [`src/rooms/verify/webhooks/paypalVerifier.ts`](../src/rooms/verify/webhooks/paypalVerifier.ts):
```typescript
const verificationPayload = {
  auth_algo: headers["paypal-auth-algo"],
  cert_url: headers["paypal-cert-url"],
  transmission_id: headers["paypal-transmission-id"],
  transmission_sig: headers["paypal-transmission-sig"],
  transmission_time: headers["paypal-transmission-time"],
  webhook_id: this.webhookId,
  webhook_event: rawEvent,
};
```

---

### 3. Agent Pair-Programming Workflow (APIMatic Context Plugin)
- As required by `AGENTS.md` ("Use the APIMatic PayPal Context Plugin when working on PayPal code"), our AI coding agent referenced APIMatic's context plugin to ensure zero reliance on outdated hallucinated endpoints.
- **Key Errors Avoided**:
  - Avoided deprecated Payments v1 endpoints (`/v1/payments/payment`).
  - Handled PayPal's `INSTRUMENT_DECLINED` / `PAYER_ACTION_REQUIRED` state lifecycle accurately according to current Orders v2 specifications.
  - Implemented the reconcile-by-GET pattern on capture timeout per official PayPal resilience standards.

---

## 🧪 Verification & Evidence

All APIMatic-validated gateway and verifier functions are backed by automated tests:
1. `tests/unit/paypal-gateway.test.ts` — Tests Orders v2 creation, capture, timeout handling, and custom_id anchoring.
2. `tests/unit/paypal-verifier.test.ts` — Tests webhook signature verification with mock and live PayPal contracts.
3. `tests/unit/prd83-failure-paths.test.ts` — Verifies all 7 failure recovery scenarios.

**Judge Verification**:
APIMatic Co-Founder **Ameer Hassan** can inspect `src/rooms/execute/paypalGateway.ts` and `src/rooms/verify/webhooks/paypalVerifier.ts` to verify 100% adherence to APIMatic's strict API validation patterns.
