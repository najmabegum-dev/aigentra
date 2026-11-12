# AIGENTRA — Judge's Verification Guide & Proof Dossier

> **"The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves."**

Welcome judges! This document outlines the architecture, live PayPal Sandbox verification proofs, safety invariants, and exact verification steps for the AIGENTRA submission.

---

## 🏆 Why AIGENTRA: The Best Use of PayPal + AI

Most AI shopping and payment demos make a fatal design mistake: **they give the language model a tool that creates or captures orders directly**. Under prompt injection, jailbreaks, or hallucinations, the model can alter quantities, tamper with prices, or siphon funds.

**AIGENTRA takes a radical architectural stand**:
1. **Zero LLM Payment Tools**: No language model in AIGENTRA ever receives a tool or credential that can spend, capture, or modify PayPal orders.
2. **Deterministic Authority Gate**: Proposals must pass a pure policy function (`evaluate(...)`) before a cryptographically signed Mandate (`Ed25519 JWS`) is issued.
3. **PayPal Orders v2 as the Sovereign Execution Engine**: Every financial movement is a PayPal Orders v2 Sandbox transaction, authorized strictly by a single-use Mandate and anchored with `custom_id = proposal_hash`.
4. **Tamper-Evident Ledger**: Every state transition appends a SHA-256 hash-chained block to the immutable audit trail.

---

## 📋 Live PayPal Sandbox Execution Proofs

### Verified Sandbox Captures
Live capture flow completed and verified end-to-end on PayPal Sandbox:
- **Order ID**: `3EW77512CL478240A`
  - **Capture ID**: `8CC43315P4326833W`
  - **Amount**: `$10.00 USD`
  - **Status**: `COMPLETED`
  - **Buyer**: Personal Sandbox Buyer Account
  - **Merchant**: US Sandbox Business Merchant (`sb-76oqy53795010@business.example.com`)
- **Order ID**: `86723729NA318782U`
  - **Capture ID**: `7PK34147AL947684C`
  - **Amount**: `$10.00 USD`
  - **Status**: `COMPLETED`

---

## 🛡️ PRD §8.3 Failure Paths Matrix (100% Tested)

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

In [`tests/unit/attack-lab.test.ts`](../tests/unit/attack-lab.test.ts), all 7 adversarial scenarios pass with **0 PayPal requests leaked**:
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
# 1. Full automated test suite (39 test files, 302 tests green)
npm test

# 2. Strict TypeScript type check (zero errors)
npm run typecheck

# 3. Code formatting and linting (zero warnings/errors)
npm run lint

# 4. Golden Intent verification (20/20 intents schema-verified)
npm run verify:intents
```
