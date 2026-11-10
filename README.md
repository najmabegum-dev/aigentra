# AIGENTRA — Bounded Financial Authority Layer for AI Agents

> **"The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves."**

AIGENTRA is an authority gate between autonomous AI shopping agents and PayPal Orders v2. It ensures that language models can never directly spend funds, create orders, or manipulate financial totals. Every execution requires a cryptographically signed, single-use, hash-chained Mandate evaluated against pure deterministic policy rules.

---

## 🏛️ Core Architecture: Four Rooms

1. **Propose Room (`src/rooms/propose`)**:
   - Intent parsing, natural language shopping recommendations (Channel3 catalog with seeded fallback).
   - Generates structured draft proposals.
   - **Golden Rule 1**: Never holds PayPal credentials or execute capabilities.

2. **Authorize Room (`src/rooms/authorize`)**:
   - Deterministic policy evaluation engine (`evaluate(proposal, policy, spendState, now)`).
   - RFC 8785 canonical proposal hashing (`proposal_hash`).
   - EdDSA (Ed25519) JWS cryptographic Mandate issuance and atomic single-use consumption.

3. **Execute Room (`src/rooms/execute`)**:
   - PayPal Sandbox Orders v2 Gateway (`PayPalGateway` using `@paypal/paypal-server-sdk`) & deterministic `DevStubGateway`.
   - **Golden Rule 2**: Functions accept only a branded `VerifiedMandate`.
   - Anchors `custom_id = proposal_hash` and `invoice_id = AGX-<proposal_id>`.
   - Reconcile-by-GET on capture timeout (PRD §8.3).

4. **Verify Room (`src/rooms/verify`)**:
   - Tamper-evident hash-chained append-only ledger (SHA-256 genesis block and monotonic sequence).
   - Webhook inbox with raw-body signature verification (`PayPalVerifier` calling `/v1/notifications/verify-webhook-signature`).
   - Out-of-order reconciliation and drift detection (`DRIFT_FLAGGED`).
   - AG Studio Control Tower and read-only Auditor Agent.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript Strict
- **Styling & UI**: Tailwind CSS, shadcn/ui design patterns, Lucide icons
- **Database**: Drizzle ORM with dual-mode storage:
  - Local embedded zero-config **PGlite** (in `.data/`)
  - Production **PostgreSQL** (e.g. Neon)
- **AI & Models**: Vercel AI SDK (`@ai-sdk/google`) with Gemini 2.0 Flash (`gemini-2.0-flash`) default (with deterministic offline replay fallback)
- **Payments**: `@paypal/paypal-server-sdk` (v2.5.0, Orders v2 Sandbox API)
- **Cryptography**: `jose` (EdDSA JWS), `canonicalize` (RFC 8785), Node.js `crypto` (HMAC / SHA-256)
- **Testing**: Vitest + `fast-check` (property-based testing)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### 2. Installation
```bash
git clone https://github.com/najmabegum-dev/aigentra.git
cd aigentra
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

Key environment variables:
- `PAYMENT_MODE`: `"dev_stub"` for offline/testing or `"paypal"` for live PayPal Sandbox (required in production).
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`: PayPal Developer REST App credentials (server-only).
- `PAYPAL_WEBHOOK_ID`: PayPal Sandbox Webhook ID for signature verification.
- `MANDATE_SIGNING_PRIVATE_KEY` & `MANDATE_SIGNING_PUBLIC_KEY`: Ed25519 key pair for cryptographic Authority Mandates (generate with `npm run keys:generate`).
- `AI_PROVIDER`: Default `"gemini"`.
- `GEMINI_API_KEY`: Google AI Studio API key for `gemini-2.0-flash` (optional; system gracefully falls back to deterministic Replay mode if omitted).
- `CHANNEL3_API_KEY`: Channel3 API key (optional; falls back to seeded catalog).
- `DATABASE_URL`: PostgreSQL connection string (optional; falls back to embedded PGlite in `.data/`).

### 4. Running the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

AIGENTRA has extensive unit, integration, and property-based test suites:

```bash
# Run full Vitest test suite (39 test files, 302+ tests)
npm test

# Run TypeScript strict typecheck (zero errors)
npm run typecheck

# Run ESLint validation (zero warnings/errors)
npm run lint

# Verify 20 Golden AI Intent test set
npm run verify:intents
```

---

## 🔒 Security & Golden Rules
1. No LLM ever receives a tool that can spend, capture, or modify payment orders.
2. `src/rooms/execute` accepts only a cryptographically verified `VerifiedMandate`.
3. Policy engine is a pure function: no network, no database, no clock reads inside.
4. Money is integer cents plus ISO currency. Never floats.
5. All prices and totals are recomputed server-side from canonical catalog data.
6. Webhook verification checks raw-body signatures with PayPal before any state change.
7. Every state transition appends a hash-chained ledger block.
