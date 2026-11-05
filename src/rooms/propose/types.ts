import { z } from "zod";

/**
 * Strict schema for Intent Parser output (PRD §9.1)
 *
 * Rules:
 * 1. Never invent a budget; if missing or ambiguous, budget_cents must be omitted.
 * 2. Never guess a currency; AIGENTRA sandbox operates strictly in USD.
 * 3. If budget is missing or ambiguous, clarifying_question must be set.
 */
export const parsedIntentSchema = z.object({
  goal: z
    .string()
    .min(1, "Goal cannot be empty")
    .describe("Concise shopping goal describing the product sought"),
  budget_cents: z
    .number()
    .int()
    .positive("Budget must be a positive integer in cents")
    .optional()
    .describe(
      "Maximum budget ceiling in integer cents. Must ONLY be populated if the user explicitly specified a budget. NEVER invent or guess a budget."
    ),
  currency: z
    .literal("USD")
    .default("USD")
    .describe("Currency ISO code. AIGENTRA strictly operates in USD for the PayPal sandbox."),
  constraints: z
    .array(z.string())
    .default([])
    .describe("Specific requirements extracted from the user request such as brand, connectivity, color"),
  clarifying_question: z
    .string()
    .optional()
    .describe(
      "Polite clarifying question asking for missing budget, unsupported currency, or ambiguous intent. Required whenever budget or currency is missing."
    ),
  is_replay: z
    .boolean()
    .default(false)
    .describe("True when this intent was generated via pre-recorded Replay mode"),
  replay_scenario_id: z
    .string()
    .optional()
    .describe("Replay scenario identifier if served via Replay mode"),
});

export type ParsedIntent = z.infer<typeof parsedIntentSchema>;

export interface IntentParseRequest {
  user_text: string;
  workspace_id: string;
}

export interface IntentParseResult {
  ok: boolean;
  intent: ParsedIntent;
  mode: "live" | "replay";
  reason?: string;
}
