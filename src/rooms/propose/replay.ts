import type { ParsedIntent } from "./types";

export const DEMO_REPLAY_KEYBOARD: ParsedIntent = {
  goal: "Ergonomic mechanical keyboard for home office",
  budget_cents: 10000, // $100.00 USD
  currency: "USD",
  constraints: ["ergonomic layout", "mechanical switches", "USB-C or Bluetooth", "under $100"],
  is_replay: true,
  replay_scenario_id: "keyboard_demo",
};

export const DEMO_REPLAY_HEADSET: ParsedIntent = {
  goal: "Noise cancelling wireless headset for remote meetings",
  budget_cents: 8000, // $80.00 USD
  currency: "USD",
  constraints: ["active noise cancellation", "wireless Bluetooth", "integrated microphone", "under $80"],
  is_replay: true,
  replay_scenario_id: "headset_demo",
};

/**
 * Returns a pre-recorded replay output matching the demo intent,
 * ensuring the demo never dead-ends when AI quota or keys are unavailable.
 */
export function getReplayIntent(userText: string): ParsedIntent {
  const normalized = (userText || "").toLowerCase().trim();

  // 1. Missing or empty prompt
  if (!normalized) {
    return {
      goal: "Unspecified item",
      currency: "USD",
      constraints: [],
      clarifying_question: "What item would you like your purchasing agent to look for?",
      is_replay: true,
      replay_scenario_id: "unspecified_intent",
    };
  }

  // 1b. Prompt injection / adversarial patterns (PRD §9.2)
  if (
    normalized.includes("ignore previous") ||
    normalized.includes("ignore all") ||
    normalized.includes("system prompt") ||
    normalized.includes("bypass") ||
    normalized.includes("without policy")
  ) {
    return {
      goal: "Adversarial request flagged",
      currency: "USD",
      constraints: ["adversarial pattern flagged"],
      clarifying_question:
        "This request contains instructions attempting to override policy rules. Could you please rephrase with a specific product purchase?",
      is_replay: true,
      replay_scenario_id: "injection_flagged",
    };
  }

  // 2. Foreign currency check
  if (normalized.includes("eur") || normalized.includes("euro") || normalized.includes("gbp") || normalized.includes("£") || normalized.includes("€")) {
    return {
      goal: userText.trim(),
      currency: "USD",
      constraints: ["currency adjustment required"],
      clarifying_question: "AIGENTRA PayPal sandbox operates strictly in USD. Could you please specify your budget in USD?",
      is_replay: true,
      replay_scenario_id: "currency_clarification",
    };
  }

  // 3. Ambiguous input without budget (e.g. "find something nice under 100" without currency or item)
  if (normalized.includes("under 100") && !normalized.includes("usd") && !normalized.includes("$") && !normalized.includes("dollar")) {
    return {
      goal: "General items under 100",
      currency: "USD",
      constraints: [],
      clarifying_question: "Could you specify what kind of item you are looking for and confirm the currency is USD?",
      is_replay: true,
      replay_scenario_id: "ambiguous_budget",
    };
  }

  // 4. Missing budget entirely
  const hasDollarSign = normalized.includes("$");
  const hasBucksOrDollars = normalized.includes("dollar") || normalized.includes("buck");
  const hasDigitBudget = /\b\d{1,4}\s*(usd|dollars?|bucks?)\b/.test(normalized);

  if (!hasDollarSign && !hasBucksOrDollars && !hasDigitBudget && !normalized.includes("under")) {
    return {
      goal: userText.trim(),
      currency: "USD",
      constraints: [],
      clarifying_question: "What is your target budget ceiling in USD for this item?",
      is_replay: true,
      replay_scenario_id: "missing_budget",
    };
  }

  // 5. Match Demo Scenario 2: Audio / Headset
  if (/\b(headsets?|headphones?|audio|microphone|mics?|earbuds?)\b/i.test(normalized)) {
    return {
      ...DEMO_REPLAY_HEADSET,
      budget_cents: extractBudgetCents(normalized) || DEMO_REPLAY_HEADSET.budget_cents,
    };
  }

  // 6. Match Demo Scenario 1: Keyboard / Office Accessories (Default demo)
  return {
    ...DEMO_REPLAY_KEYBOARD,
    goal: normalized.includes("keyboard")
      ? DEMO_REPLAY_KEYBOARD.goal
      : `Purchase: ${userText.trim().slice(0, 60)}`,
    budget_cents: extractBudgetCents(normalized) || DEMO_REPLAY_KEYBOARD.budget_cents,
  };
}

function extractBudgetCents(text: string): number | undefined {
  const match = /\$(\d+(?:\.\d{2})?)|\b(\d+)\s*(?:dollars?|bucks?|usd)\b/i.exec(text);
  if (match) {
    const val = parseFloat(match[1] || match[2]);
    if (!isNaN(val) && val > 0) {
      return Math.round(val * 100);
    }
  }
  return undefined;
}
