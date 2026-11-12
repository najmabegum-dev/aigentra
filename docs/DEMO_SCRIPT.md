# AIGENTRA — 3-Minute Video Demo & Pitch Script

> **Devpost Submission Requirement**: Video under 3 minutes, showing end-to-end functionality on the target device, uploaded to YouTube with public link.

---

## ⏱️ Video Timeline Overview

- **0:00 – 0:30 (The Hook & Threat)**: The fatal flaw in current AI shopping agents.
- **0:30 – 1:00 (The Architectural Solution)**: Introducing the Four Rooms & Golden Rules.
- **1:00 – 1:55 (Live End-to-End Walkthrough)**: Natural language intent → policy evaluation → human approval → PayPal Sandbox consent & server-side capture.
- **1:55 – 2:35 (Attack Lab Defense)**: Live red-team demonstration: prompt injection & price tampering blocked with 0 PayPal calls leaked.
- **2:35 – 3:00 (AG Studio Telemetry & Closing)**: Hash-chained audit ledger, read-only Auditor agent, closing punchline.

---

## 🎬 Second-by-Second Script

### Phase 1: The Problem (0:00 – 0:30)
* **Screen**: Landing page (`http://localhost:3000`), zooming into the headline: *"The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves."*
* **Voiceover**:
  > *"Every AI shopping demo today makes a fatal mistake: it gives an LLM an API key or function tool to execute payments directly. Under prompt injection, cart swaps, or hallucinations, an autonomous agent can drain bank accounts or manipulate prices.
  >
  > Financial execution cannot belong to a probabilistic model.
  > That’s why we built **AIGENTRA** — a bounded financial authority layer between autonomous AI agents and PayPal Orders v2."*

---

### Phase 2: The Architecture (0:30 – 1:00)
* **Screen**: Bento Grid on the landing page highlighting the **Four Rooms**: `Propose`, `Authorize`, `Execute`, `Verify`.
* **Voiceover**:
  > *"AIGENTRA operates on two inviolable golden rules:
  > First: No language model ever receives credentials or tools to create, capture, or modify PayPal orders.
  > Second: PayPal execution functions accept only a cryptographically signed, single-use EdDSA Mandate issued by our deterministic policy engine.
  > The AI proposes in Room 1. AIGENTRA authorizes in Room 2. PayPal executes in Room 3. And an immutable, hash-chained ledger proves in Room 4."*

---

### Phase 3: Live End-to-End Walkthrough (1:00 – 1:55)
* **Screen**: Click **"Enter demo workspace"** → navigate to **Agent Workspace** (`/agent`).
* **Action**:
  1. In the chat box, type: *"Find me a mechanical keyboard and ergonomic mouse under $150."*
  2. Show Gemini 2.0 Flash parse intent into structured parameters and query the Channel3 catalog.
  3. Show the server recomputing prices in integer cents and generating the Proposal.
  4. Point to the **DecisionCard**: *"Verdict: REQUIRE_APPROVAL — Exceeds $100 human approval threshold."*
* **Action**: Click **"View in Approval Centre"** (`/approvals`).
  1. Show the side-by-side comparison: Cart vs Active Policy guardrails.
  2. Point to the countdown mandate expiry ring.
  3. Click **"Approve & Issue Mandate"**.
* **Action**: Redirect to Checkout flow (`/checkout`).
  1. Show the continuous 5-stage **AuthorityRail** illuminating.
  2. Click **"Proceed to PayPal Sandbox Consent"** → Open the official PayPal Sandbox login modal.
  3. Log in with Sandbox personal buyer credentials, click **"Complete Purchase"**.
  4. Return to AIGENTRA: Show server-side capture completing, PayPal Order ID, Capture ID, and custom_id anchored with `proposal_hash`.
* **Voiceover**:
  > *"Notice the separation of jurisdictions: AIGENTRA approves the spending authority. PayPal captures buyer consent and executes the funds. The single-use mandate is burned atomically, preventing replay."*

---

### Phase 4: Attack Lab Red-Team Defense (1:55 – 2:35)
* **Screen**: Navigate to **Attack Lab** (`/attack-lab`). Show the dark red-team console.
* **Action**: Click **"Run All Attacks (A1–A7)"**.
  1. Watch scenarios stream in with green `[✓ DEFENDED]` badges.
  2. Highlight **A1 (Prompt Injection in Product Description)**: Blocked with `OVER_CART_CAP`.
  3. Highlight **A3 (Price Tampering)**: Blocked with `ITEM_PRICE_MISMATCH`.
  4. Highlight **A4 (Cart Swap After Approval)**: Rejected with `HASH_MISMATCH`.
  5. Point to the prominent glowing badge: **"PayPal calls leaked: 0"**.
* **Voiceover**:
  > *"To prove this isn’t security through obscurity, our Attack Lab subjects the gate to 7 adversarial attacks. Under prompt injections, hidden instructions, and cart tampering, the policy engine rejects the payload. Across all 7 attacks, exactly ZERO unauthorized calls ever reach PayPal."*

---

### Phase 5: AG Studio Control Tower & Wrap-up (2:35 – 3:00)
* **Screen**: Navigate to **Control Tower** (`/studio`).
* **Action**:
  1. Point to the **Authority Budget Ring** and **Decision Mix** widgets.
  2. Show the **Ledger Grid** with SHA-256 hash chains.
  3. Open the **Auditor Agent** tab, type *"Summarize all blocked attempts today"*, and show the read-only AI explaining decisions using the tamper-evident ledger.
* **Voiceover**:
  > *"Every financial event is sealed in an append-only SHA-256 hash-chained ledger and visualized in the AG Studio Control Tower, interrogated by our read-only Auditor Agent.
  >
  > AI agents will power the next economy. AIGENTRA ensures they remain safe, bounded, and accountable.
  > PayPal executes the money. AIGENTRA governs the intelligence. Thank you."*

---

## 💡 Recording Tips for the Submitter
1. Keep the browser at 1080p full screen.
2. Use Chrome in Dark Mode.
3. Keep the mouse cursor steady and purposeful.
4. Record without background music (Devpost explicitly forbids copyrighted audio).
5. Ensure the final video length is between **2:45 and 2:55** (strictly under the 3:00 cutoff).
