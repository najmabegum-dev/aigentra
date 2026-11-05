import fs from "node:fs";
import path from "node:path";
import { parsedIntentSchema, type ParsedIntent } from "../src/rooms/propose/types";
import { getReplayIntent } from "../src/rooms/propose/replay";

interface GoldenIntentFixture {
  id: string;
  description: string;
  input: string;
  expected: {
    has_budget?: boolean;
    expected_budget_cents?: number;
    currency?: string;
    needs_clarification?: boolean;
    reason?: string;
  };
}

export function runGoldenSetVerification(fixturesPath?: string): {
  passed: number;
  total: number;
  results: Array<{ id: string; ok: boolean; goal: string; hasBudget: boolean; clarifying: string | null }>;
} {
  const filePath =
    fixturesPath || path.resolve(process.cwd(), "tests/fixtures/intents.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  const fixtures: GoldenIntentFixture[] = JSON.parse(rawData);

  let passed = 0;
  const results = [];

  for (const item of fixtures) {
    // Run intent parser through deterministic engine/replay parser
    const output: ParsedIntent = getReplayIntent(item.input);

    // 1. Strict Schema Validity Check
    const schemaValidation = parsedIntentSchema.safeParse(output);
    if (!schemaValidation.success) {
      console.error(`❌ [${item.id}] Schema validation failed:`, schemaValidation.error);
      results.push({
        id: item.id,
        ok: false,
        goal: output.goal || "ERROR",
        hasBudget: output.budget_cents !== undefined,
        clarifying: output.clarifying_question || null,
      });
      continue;
    }

    const intent = schemaValidation.data;

    // 2. Safety Invariant 1: No Invented Budget (PRD §9.1)
    if (item.expected.has_budget === false && intent.budget_cents !== undefined) {
      console.error(
        `❌ [${item.id}] SAFETY VIOLATION: Invented budget ${intent.budget_cents} for input without explicit budget: "${item.input}"`
      );
      results.push({
        id: item.id,
        ok: false,
        goal: intent.goal,
        hasBudget: true,
        clarifying: intent.clarifying_question || null,
      });
      continue;
    }

    // 3. Safety Invariant 2: Clarifying Question Required on Ambiguity (PRD §9.1)
    if (item.expected.needs_clarification === true && !intent.clarifying_question) {
      console.error(
        `❌ [${item.id}] SAFETY VIOLATION: Ambiguous intent without clarifying question: "${item.input}"`
      );
      results.push({
        id: item.id,
        ok: false,
        goal: intent.goal,
        hasBudget: intent.budget_cents !== undefined,
        clarifying: null,
      });
      continue;
    }

    passed++;
    results.push({
      id: item.id,
      ok: true,
      goal: intent.goal,
      hasBudget: intent.budget_cents !== undefined,
      clarifying: intent.clarifying_question || null,
    });
  }

  return { passed, total: fixtures.length, results };
}

// Direct CLI execution
console.log("Running Golden Set Intent Schema Verification (PRD §9.1, §9.3)...\n");
const { passed, total, results } = runGoldenSetVerification();

console.table(
  results.map((r) => ({
    ID: r.id,
    Status: r.ok ? "PASS" : "FAIL",
    Goal: r.goal.slice(0, 35),
    Budget: r.hasBudget ? "Set" : "None",
    Clarification: r.clarifying ? r.clarifying.slice(0, 35) + "..." : "None",
  }))
);

console.log(`\nResult: ${passed}/${total} Golden Intents Verified Against Strict Schema & Safety Invariants.`);

if (passed !== total) {
  process.exit(1);
}
