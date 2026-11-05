import { describe, it, expect } from "vitest";
import {
  assertIntegerCents,
  safeAddCents,
  safeMultiplyCents,
  centsToPayPalString,
  parseStringToCents,
  validateCurrency,
  MoneyError,
} from "@/lib/money";

describe("Money Utilities (src/lib/money.ts)", () => {
  describe("assertIntegerCents", () => {
    it("accepts valid positive integer cents", () => {
      expect(() => assertIntegerCents(0)).not.toThrow();
      expect(() => assertIntegerCents(100)).not.toThrow();
      expect(() => assertIntegerCents(8499)).not.toThrow();
    });

    it("rejects floating-point numbers", () => {
      expect(() => assertIntegerCents(84.99)).toThrow(MoneyError);
      expect(() => assertIntegerCents(0.1)).toThrow(MoneyError);
    });

    it("rejects negative amounts unless explicitly allowed", () => {
      expect(() => assertIntegerCents(-500)).toThrow(MoneyError);
      expect(() => assertIntegerCents(-500, true)).not.toThrow();
    });

    it("rejects non-numbers and unsafe integers", () => {
      expect(() => assertIntegerCents("100" as any)).toThrow(MoneyError);
      expect(() => assertIntegerCents(NaN)).toThrow(MoneyError);
      expect(() => assertIntegerCents(Infinity)).toThrow(MoneyError);
    });
  });

  describe("safeAddCents", () => {
    it("safely sums multiple integer cents", () => {
      expect(safeAddCents(1000, 2500, 499)).toBe(3999);
      expect(safeAddCents()).toBe(0);
      expect(safeAddCents(500)).toBe(500);
    });

    it("throws if any item is a float", () => {
      expect(() => safeAddCents(100, 50.5)).toThrow(MoneyError);
    });
  });

  describe("safeMultiplyCents", () => {
    it("multiplies unit cents by quantity cleanly", () => {
      expect(safeMultiplyCents(1999, 3)).toBe(5997);
      expect(safeMultiplyCents(2500, 0)).toBe(0);
      expect(safeMultiplyCents(0, 5)).toBe(0);
    });

    it("rejects floating quantities or float cents", () => {
      expect(() => safeMultiplyCents(1000, 2.5)).toThrow(MoneyError);
      expect(() => safeMultiplyCents(10.5, 2)).toThrow(MoneyError);
      expect(() => safeMultiplyCents(1000, -1)).toThrow(MoneyError);
    });
  });

  describe("centsToPayPalString", () => {
    it("formats integer cents to standard decimal string with 2 digits", () => {
      expect(centsToPayPalString(8499)).toBe("84.99");
      expect(centsToPayPalString(100)).toBe("1.00");
      expect(centsToPayPalString(5)).toBe("0.05");
      expect(centsToPayPalString(0)).toBe("0.00");
      expect(centsToPayPalString(123456)).toBe("1234.56");
    });

    it("rejects floating-point input", () => {
      expect(() => centsToPayPalString(84.99)).toThrow(MoneyError);
    });
  });

  describe("parseStringToCents", () => {
    it("parses valid decimal strings without float drift", () => {
      expect(parseStringToCents("84.99")).toBe(8499);
      expect(parseStringToCents("1.00")).toBe(100);
      expect(parseStringToCents("0.05")).toBe(5);
      expect(parseStringToCents("84")).toBe(8400);
      expect(parseStringToCents("84.9")).toBe(8490);
      expect(parseStringToCents("0")).toBe(0);
    });

    it("rejects amounts with more than 2 decimal places", () => {
      expect(() => parseStringToCents("84.999")).toThrow(MoneyError);
      expect(() => parseStringToCents("1.234")).toThrow(MoneyError);
    });

    it("rejects invalid characters, negative signs, and non-numeric inputs", () => {
      expect(() => parseStringToCents("-84.99")).toThrow(MoneyError);
      expect(() => parseStringToCents("$84.99")).toThrow(MoneyError);
      expect(() => parseStringToCents("abc")).toThrow(MoneyError);
      expect(() => parseStringToCents("")).toThrow(MoneyError);
    });
  });

  describe("validateCurrency", () => {
    it("accepts USD", () => {
      expect(validateCurrency("USD")).toBe("USD");
    });

    it("rejects non-USD currencies in sandbox", () => {
      expect(() => validateCurrency("EUR")).toThrow(MoneyError);
      expect(() => validateCurrency("INR")).toThrow(MoneyError);
    });
  });
});
