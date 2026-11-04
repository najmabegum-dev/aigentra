import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Vitest & Zod Setup Test", () => {
  it("validates that vitest test runner is operational", () => {
    expect(true).toBe(true);
  });

  it("verifies zod schema validation works as expected", () => {
    const MoneySchema = z.object({
      amountCents: z.number().int().nonnegative(),
      currency: z.literal("USD"),
    });

    const validData = { amountCents: 5000, currency: "USD" as const };
    const parsed = MoneySchema.safeParse(validData);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amountCents).toBe(5000);
      expect(parsed.data.currency).toBe("USD");
    }

    const invalidData = { amountCents: 12.34, currency: "EUR" };
    const invalidParsed = MoneySchema.safeParse(invalidData);
    expect(invalidParsed.success).toBe(false);
  });
});
