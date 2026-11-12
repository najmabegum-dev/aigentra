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
- Update `docs/PROGRESS.md` in the SAME commit as the work it describes (see "Git and progress rules").

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

Acceptance test from the PRD passes on the deployed app, automated tests exist for deterministic logic, failure states render sensible messages, `docs/JUDGES.md` has a proof link, `docs/PROGRESS.md` is updated, lint, typecheck and tests all pass, and the work is committed and pushed following "Git and progress rules".
## Honesty rules
Do not invent users, metrics, quotes or capabilities. Label seeded data as seeded. Label the Channel3-to-PayPal settlement stand-in honestly. We are AP2-inspired, not AP2-compliant.
## Git and progress rules

These apply from now on. Do not rewrite existing history.

### When to commit
- Commit after every meaningful unit of work that is done and working: one function, one endpoint, one component, one fix, one config change. Never wait until the end of a phase.
- Before each commit run `npm run lint`, `npm run typecheck`, `npm test`. If any fail, fix first. Never commit broken code.
- One logical change per commit. If the summary needs "and", split it.
- Write the test first and commit it separately: `test(scope): ...`, then `feat(scope): ...`.
- If more than about 3 files or 100 lines changed without a commit, you went too long. Split it.
- Stage files explicitly with `git add <file>`. Never `git add .`. Check `git status` and `git diff --staged` first.
- Keep unrelated changes out of the commit (config, refactor, feature each get their own).

### Commit message format
`type(scope): imperative summary`
- Subject 72 characters or fewer, lowercase, no period, space after the colon, always with a scope.
- Imperative mood: "add", "fix", "implement".
- Add a body explaining why when it is not obvious.
- Types: `feat` (new behaviour only), `fix`, `test`, `docs`, `refactor`, `chore` (scaffold, tooling, deps, config), `build`, `style`.
- Scopes match the folder map: `propose`, `authorize`, `execute`, `verify`, `db`, `ui`, `studio`, `env`, `deps`, `progress`.
- Examples: `feat(propose): add Channel3 search client`, `test(authorize): cover EVAL_ERROR deny path`, `chore(deps): add fast-check`.

### Branching
- Never commit directly to `main`.
- One branch per phase: `feat/<name>`, `fix/<name>`, `chore/<name>`.
- When a phase is complete and checks pass, open a PR into `main` with a short summary and how it was tested, then merge.
- After merging, tag: `git tag phase-<n>` then `git push --tags`.
- Push after every commit so work is never only local.

### docs/PROGRESS.md
- Update it in the same commit as the work. Never "catch up" later.
- Phase start: add a section with status, goal, and branch name.
- Each unit of work: tick the checklist item and add one change-log line with the short commit hash.
- Phase end: mark done, add the PR link, the tag, and what was tested.
- Record blockers, skipped items and decisions under Issues / Decisions. Do not hide problems.
- Append only. Never delete or rewrite past phases except to fix a factual mistake.
- Use this shape for each new phase, and keep the existing phases untouched:

```md
## Phase <n>: <name>
- Status: In progress | Done | Blocked
- Branch: feat/<name>
- PR / Tag: #<n> / phase-<n>

### Checklist
- [x] <item> (<short hash>)
- [ ] <item>

### Tested
- <command run and result>

### Issues / Decisions
- <problem or choice, and why>

### Next
- <what comes next>
```
### Commit Flow for every unit of work
1. Make the change. If it touches `authorize`, `execute` or `verify`, get plan approval first.
2. Run lint, typecheck and tests. Fix failures.
3. Update `docs/PROGRESS.md`.
4. Stage files explicitly and review `git diff --staged` for secrets.
5. Ensure you are on the `main` branch (`git checkout main`), commit with the format above, and push directly to `main`. Do not create new feature branches.

### Security and Hygiene
- Never touch, create, edit, delete or `.env*` files. Only `.env.example` with placeholder values is allowed. This is the one exception to "never edit `.env*` files", and the agent may not read/echo `.env*` files into tool output.
- If a secret is ever exposed, stop and tell me immediately so the key can be rotated. Do not save secrets to chat logs/memory.
- Commit directly to `main` for standard work, but never force-push (`git push --force`) or rewrite shared history.
- Do not commit temp scripts, build output or generated files.
- Keep `README.md` accurate (architecture, directory setup, env var names, how to run and test).
