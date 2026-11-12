import { describe, it, expect } from "vitest";
import { parsedIntentSchema } from "@/rooms/propose/types";
import { getReplayIntent, DEMO_REPLAY_KEYBOARD, DEMO_REPLAY_HEADSET } from "@/rooms/propose/replay";
import { parseIntent, getLanguageModel, DEFAULT_GEMINI_MODEL } from "@/rooms/propose/ai";
import { runGoldenSetVerification } from "../../scripts/verify-golden-intents";
import fs from "node:fs";
import path from "node:path";

describe("Intent Parser & AI Module (PRD §9.1 - §9.3)", () => {
  it("verifies the chosen Gemini model ID", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.0-flash");
  });

  it("verifies all 20 golden set test intents against Zod schema and safety rules", () => {
    const { passed, total } = runGoldenSetVerification();
    expect(total).toBe(20);
    expect(passed).toBe(20);
  });

  it("delivers pre-recorded Replay output for demo keyboard request", () => {
    const intent = getReplayIntent("I need an ergonomic mechanical keyboard under $100 USD");
    expect(intent.is_replay).toBe(true);
    expect(intent.replay_scenario_id).toBe("keyboard_demo");
    expect(intent.budget_cents).toBe(10000);
    expect(intent.currency).toBe("USD");
    expect(intent.constraints).toContain("ergonomic layout");
  });

  it("delivers pre-recorded Replay output for demo headset request", () => {
    const intent = getReplayIntent("Find a noise cancelling wireless headset for remote meetings under $80 USD");
    expect(intent.is_replay).toBe(true);
    expect(intent.replay_scenario_id).toBe("headset_demo");
    expect(intent.budget_cents).toBe(8000);
    expect(intent.currency).toBe("USD");
    expect(intent.constraints).toContain("active noise cancellation");
  });

  it("asks clarifying question instead of inventing budget when missing", () => {
    const intent = getReplayIntent("I need a USB-C charging cable");
    expect(intent.budget_cents).toBeUndefined();
    expect(intent.clarifying_question).toBeDefined();
    expect(intent.clarifying_question?.toLowerCase()).toContain("budget");
  });

  it("asks clarifying question instead of guessing currency on foreign or ambiguous input", () => {
    const foreign = getReplayIntent("Buy a wireless mouse for 50 EUR");
    expect(foreign.clarifying_question).toBeDefined();
    expect(foreign.clarifying_question).toContain("USD");

    const ambiguous = getReplayIntent("Find something nice under 100");
    expect(ambiguous.clarifying_question).toBeDefined();
    expect(ambiguous.clarifying_question).toContain("USD");
  });

  it("degrades gracefully to Replay mode when GEMINI_API_KEY is not configured", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await parseIntent("Ergonomic keyboard under $100 USD", "ws_test_replay");
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("replay");
    expect(result.intent.is_replay).toBe(true);
    expect(result.intent.budget_cents).toBe(10000);

    if (prevKey) {
      process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it("enforces Golden Rule 1: Propose module never imports from execute or PayPal SDK", () => {
    const aiTsPath = path.resolve(process.cwd(), "src/rooms/propose/ai.ts");
    const content = fs.readFileSync(aiTsPath, "utf-8");

    const importLines = content
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    for (const line of importLines) {
      expect(line).not.toContain("/execute");
      expect(line).not.toContain("@paypal/paypal-server-sdk");
      expect(line).not.toContain("mandate");
    }
  });
});
