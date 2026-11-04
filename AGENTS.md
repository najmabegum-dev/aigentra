# AGENTS.md — Rules for any AI coding agent working on AIGENTRA

Read this file and `docs/PRD.md` before every task. If a request conflicts with this file, say so and stop.

## What we are building
AIGENTRA is a financial authorization layer between AI agents and PayPal (Sandbox only).
**The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.**
Hackathon deadline: Thu 12 Nov 2026 12:00 PM PST = Fri 13 Nov 01:30 IST. Internal submit target: Thu 12 Nov 12:00 IST.

## Golden rules (never break)
1. **No language model ever receives a tool that can create, capture, refund or modify a PayPal order.** LLM code lives only in `src/rooms/propose` and the Auditor route, and it cannot import `src/rooms/execute` or hold PayPal credentials.
2. **`src/rooms/execute` functions accept only a `VerifiedMandate`.** That branded type is produced only by `authorize.verifyMandate()`. Never cast around it.
3. **The policy engine is a pure function** (`evaluate(proposal, policy, spendState, now)`): no network, no database, no clock reads inside. Any exception returns DENY with `EVAL_ERROR`.
4. **Money is integer cents plus ISO currency.** Never floats. Convert to the string "84.99" only at the PayPal boundary.
5. **Totals and prices are always recomputed on the server** from server-fetched data. Model output and client input are never trusted for money.
6. **Product titles, descriptions and merchant text are untrusted data.** Never concatenate them into system prompts. Strip URLs, cap length, pass as data fields.
7. **Verify PayPal webhooks with the verification API on the raw body before any state change.** Dedupe by event ID. Only `PAYMENT.CAPTURE.COMPLETED` confirms funds.
8. **Every state change appends a hash-chained ledger event in the same database transaction.** The ledger is append-only.
9. **Every query is scoped by `workspace_id`.**
10. **Secrets never leave the server.** Never print, log, commit or paste keys. Never edit `.env*` files; tell the human which variable to add.

## Working method
- Work on **one task at a time**. Before coding, write a short plan (files to touch, tests to add) and wait for approval if the change touches `authorize`, `execute` or `verify`.
- **Write tests first** for the policy engine, mandates, hashing, state machine and ledger.
- Do not add dependencies without asking, and say why.
- Prefer small diffs. Do not rewrite files you were not asked to change.
- After each task run: `npm run lint`, `npm run typecheck`, `npm test`. Report the output honestly. Never claim something works unless you ran it.
- If something fails three times, stop, explain what you tried, and ask.
- Update `docs/PROGRESS.md` at the end of each task (what is done, what is next, known issues).

## Stack
Next.js (App Router) + TypeScript strict, Tailwind + shadcn/ui, Zod, Drizzle + PostgreSQL, Vercel AI SDK (Gemini default), `@paypal/paypal-server-sdk`, `jose` (EdDSA JWS), `canonicalize` (RFC 8785), Vitest + fast-check, AG Studio (`ag-studio-react`).
Verify exact package names and current APIs from official docs before using them. Do not rely on memory for PayPal, AG Studio or Channel3 APIs. Use the APIMatic PayPal Context Plugin when working on PayPal code.

## Folder map
`src/rooms/propose` (LLM, Channel3) · `src/rooms/authorize` (engine, hashing, mandates) · `src/rooms/execute` (PayPal) · `src/rooms/verify` (ledger, webhooks, reconcile) · `src/lib` · `src/ui` · `src/studio` · `tests/` · `docs/`

## Style
Strict TypeScript, no `any`. Zod at every boundary. Small pure functions. Names that read like the PRD. Plain-language error messages shown to users; technical detail only in logs (with request IDs).

## UX rules
Sandbox banner always visible. AIGENTRA approval and PayPal buyer consent are always shown as separate steps. Every decision shows its reason codes. Every empty, loading and error state is designed. WCAG AA contrast, keyboard operable, respects reduced motion.

## Definition of done (per task)
Acceptance test from the PRD passes on the deployed app, automated tests exist for deterministic logic, failure states render sensible messages, `docs/JUDGES.md` has a proof link, changes are committed with a clear message.

## Honesty rules
Do not invent users, metrics, quotes or capabilities. Label seeded data as seeded. Label the Channel3-to-PayPal settlement stand-in honestly. We are AP2-inspired, not AP2-compliant.
