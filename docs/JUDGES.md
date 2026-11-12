# AIGENTRA — Judge's Verification Guide & Proof Dossier

> **"The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves."**

Welcome judges! This document outlines the architecture, live PayPal Sandbox verification proofs, safety invariants, sponsor technology integrations, and exact verification steps for the AIGENTRA submission.

---

## 🏆 Why AIGENTRA: The Best Use of PayPal + AI & Agentic Commerce

Most AI shopping and payment demos make a fatal design mistake: **they give the language model a tool that creates or captures orders directly**. Under prompt injection, jailbreaks, or hallucinations, the model can alter quantities, tamper with prices, or siphon funds.

**AIGENTRA takes a radical architectural stand**:
1. **Zero LLM Payment Tools**: No language model in AIGENTRA ever receives a tool or credential that can spend, capture, or modify PayPal orders (`src/rooms/propose` has zero imports from `src/rooms/execute`).
2. **Deterministic Authority Gate**: Proposals must pass a pure policy function (`evaluate(...)`) before a cryptographically signed Mandate (`Ed25519 JWS`) is issued.
3. **PayPal Orders v2 as the Sovereign Execution Engine**: Every financial movement is a PayPal Orders v2 Sandbox transaction, authorized strictly by a single-use Mandate and anchored with `custom_id = proposal_hash`.
4. **Tamper-Evident Ledger**: Every state transition appends a SHA-256 hash-chained block to the immutable audit trail.
5. **Reconcile-by-GET & Resilience**: Full implementation of all 7 failure scenarios in PRD §8.3 (timeouts, duplicate webhooks, out-of-order deliveries, instrument declines).

---

## 🏅 Sponsor Technology Jury Evaluation Guide

### 1. For PayPal Judges (Jo Franchetti, Eddie Jaoude, Marco Podien, Karthik Ravi, Himraj Singh, Nathaniel Olson)
- **SDK**: Built with official `@paypal/paypal-server-sdk` (v2.5.0) in [`src/rooms/execute/paypalGateway.ts`](../src/rooms/execute/paypalGateway.ts).
- **Orders v2 Sandbox**: Live order creation, authorization, and capture with anchored metadata (`custom_id = proposal_hash`, `invoice_id = AGX-<proposal_id>`).
- **Webhook Signature Verification**: Raw body signature verification against `/v1/notifications/verify-webhook-signature` using transmission headers in [`src/rooms/verify/webhooks/paypalVerifier.ts`](../src/rooms/verify/webhooks/paypalVerifier.ts).
- **Proof of Live Captures**:
  - Order ID: `3EW77512CL478240A` → Capture ID: `8CC43315P4326833W` ($10.00 USD, COMPLETED)
  - Order ID: `86723729NA318782U` → Capture ID: `7PK34147AL947684C` ($10.00 USD, COMPLETED)
  - US Sandbox Business Merchant: `sb-76oqy53795010@business.example.com`

### 2. For APIMatic Judges (Ameer Hassan)
- **Detailed APIMatic Dossier**: See [`docs/APIMATIC.md`](./APIMATIC.md).
- **API Modeling**: Used APIMatic to model and conform to the PayPal Orders v2 schema (`/v2/checkout/orders`) and Webhook Verification schema (`/v1/notifications/verify-webhook-signature`).
- **Coding Guidance**: Leveraged APIMatic PayPal Context patterns to implement idempotent requests (`PayPal-Request-Id`) and error handling for `INSTRUMENT_DECLINED`.

### 3. For AG Grid Judges (Sylwia Vargas)
- **AG Studio Control Tower**: Built with `ag-studio-react` (v3.1.0) mounted on `/studio` (`src/studio/StudioControlTower.tsx`).
- **Telemetry & Data Grid**: Ingests multi-source workspace data (`ledger`, `proposals`, `decisions`, `captures`) with cross-filtering, live budget telemetry, and decision distribution.
- **Auditor Agent Integration**: Embeds conversational read-only auditor querying the ledger via natural language.

### 4. For Channel3 Judges (Ignacio Valdez Bicard)
- **Catalog Integration**: Implemented in [`src/rooms/propose/catalog/channel3.ts`](../src/rooms/propose/catalog/channel3.ts).
- **Security & Integrity**: Sanitizes retailer titles, descriptions, and domains; normalizes float prices to integer cents; verifies server-side prices to prevent AI tampering.
- **Fallback**: Graceful fallback to labelled seeded catalog when API key is unconfigured.

### 5. For Render Judges (Shifra Williams)
- **Infrastructure as Code**: See [`render.yaml`](../render.yaml) configuring standard Next.js App Router Web Service and Render PostgreSQL Database.

---

## 📋 PRD §8.3 Failure Paths Matrix (100% Tested)

All 7 error situations from PRD §8.3 are implemented and covered by automated tests in [`tests/unit/prd83-failure-paths.test.ts`](../tests/unit/prd83-failure-paths.test.ts):

| # | Situation | Implemented Behaviour | Test Proof |
|---|---|---|---|
| **1** | **Buyer cancels** | Transitions to `BUYER_CANCELLED`, releases reservation, logs ledger event, renders amber UI warning. | `Row 1` in `prd83-failure-paths.test.ts` |
| **2** | **Capture declined** | Marks `CAPTURE_FAILED`, returns user-readable error, logs `PAYPAL_ORDER_CAPTURE_FAILED`. | `Row 2` in `prd83-failure-paths.test.ts` |
| **3** | **Create-order timeout** | Recovers by stored `requestId` (`create-<mandate.jti>`) without duplicate records. | `Row 3` in `prd83-failure-paths.test.ts` |
| **4** | **Capture timeout** | Reconcile-by-GET: queries `getOrder(orderId)` and adopts `COMPLETED` order. | `Row 4` in `prd83-failure-paths.test.ts` |
| **5** | **Duplicate webhook** | Primary-key collision on `paypal_event_id` returns HTTP 200 with `{ duplicate: true }`. | `Row 5` in `prd83-failure-paths.test.ts` |
| **6** | **Webhook before capture** | Reconciles out-of-order via `getOrder` and transitions state to `CONFIRMED`. | `Row 6` in `prd83-failure-paths.test.ts` |
| **7** | **Amount or custom_id mismatch** | Flags `DRIFT_FLAGGED`, logs security violation, halts execution, and renders pulsing red alert. | `Row 7` in `prd83-failure-paths.test.ts` |

---

## ⚡ Attack Lab Defense Proofs (Threat Scenarios A1–A7)

In [`tests/unit/attack-lab.test.ts`](../tests/unit/attack-lab.test.ts) and on the live UI at `/attack-lab`, all 7 adversarial scenarios pass with **0 PayPal requests leaked**:
- **A1 (Prompt Injection in Product Description)**: Denied with `OVER_CART_CAP` (0 PayPal calls).
- **A2 (Inflated Total)**: Denied with `TOTAL_MISMATCH` (0 PayPal calls).
- **A3 (Price Tampering)**: Denied with `ITEM_PRICE_MISMATCH` (0 PayPal calls).
- **A4 (Cart Swap After Approval)**: Rejected with `HASH_MISMATCH` (0 PayPal calls).
- **A5 (Mandate Replay)**: Rejected with `MANDATE_ALREADY_USED` (0 PayPal calls).
- **A6 (Forged Webhook Signature)**: Rejected with HTTP 400 + security audit log (0 PayPal calls).
- **A7 (Ledger Tampering)**: Tamper detection algorithm pinpoints exact sequence index of mutation.

---

## 🔬 How to Verify Locally

Run the following commands in the project directory:

```bash
# 1. Fast automated unit test suite (Policy engine, hashing, mandates, state machine, money, attack lab)
npm test

# 2. Strict TypeScript type check (zero errors)
npm run typecheck

# 3. Code formatting and linting (zero warnings/errors)
npm run lint

# 4. Golden Intent verification (20/20 intents schema-verified)
npm run verify:intents
```

---

## 🎥 3-Minute Presentation Video Script
See [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the complete timestamped walkthrough and narration script.
