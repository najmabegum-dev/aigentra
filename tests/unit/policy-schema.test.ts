import { describe, it, expect } from "vitest";
import {
  policyFormSchema,
  normalizeDomain,
  generatePlainLanguageSummary,
} from "@/lib/policies";

describe("Policy Studio Zod Validation & Helpers (PRD §6.1)", () => {
  const validFormData = {
    name: "Engineering Equipment Limits",
    currency: "USD" as const,
    per_item_max: 120, // $120.00
    cart_max: 150, // $150.00
    approval_threshold: 50, // $50.00
    daily_cap: 200, // $200.00
    merchant_mode: "DENYLIST" as const,
    merchants: "sketchy-deals.com\nhttps://fraud-store.org/path",
    blocked_categories: ["gift_cards", "gambling"],
    velocity_minutes: 10,
    price_max_age_seconds: 300,
    valid_from: new Date("2026-01-01T00:00:00Z").toISOString(),
    expires_at: new Date("2026-12-31T23:59:59Z").toISOString(),
    status: "ACTIVE" as const,
  };

  it("validates and parses valid form data into cents and normalized domains", () => {
    const result = policyFormSchema.safeParse(validFormData);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.per_item_max_cents).toBe(12000);
    expect(result.data.cart_max_cents).toBe(15000);
    expect(result.data.approval_threshold_cents).toBe(5000);
    expect(result.data.daily_cap_cents).toBe(20000);
    expect(result.data.merchants).toEqual(["sketchy-deals.com", "fraud-store.org"]);
  });

  it("rejects per_item_max greater than cart_max", () => {
    const invalid = {
      ...validFormData,
      per_item_max: 200, // $200 > $150
      cart_max: 150,
    };
    const result = policyFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes("Per-item limit cannot exceed cart maximum"))).toBe(true);
    }
  });

  it("rejects approval_threshold greater than cart_max", () => {
    const invalid = {
      ...validFormData,
      approval_threshold: 160, // $160 > $150
      cart_max: 150,
    };
    const result = policyFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes("Approval threshold cannot exceed cart maximum"))).toBe(true);
    }
  });

  it("rejects cart_max greater than daily_cap", () => {
    const invalid = {
      ...validFormData,
      cart_max: 300, // $300 > $200
      daily_cap: 200,
    };
    const result = policyFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes("Cart maximum cannot exceed daily spend cap"))).toBe(true);
    }
  });

  it("rejects expires_at before or equal to valid_from", () => {
    const invalid = {
      ...validFormData,
      valid_from: "2026-06-01T00:00:00Z",
      expires_at: "2026-05-01T00:00:00Z",
    };
    const result = policyFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages.some((m) => m.includes("Expiration date must be after valid-from date"))).toBe(true);
    }
  });

  it("normalizes domains: removes protocols, paths, ports and lowercases", () => {
    expect(normalizeDomain("https://WWW.Amazon.COM/electronics/ref=123")).toBe("amazon.com");
    expect(normalizeDomain("http://bestbuy.com:8080/cart")).toBe("bestbuy.com");
    expect(normalizeDomain("sub.domain.store.co.uk")).toBe("sub.domain.store.co.uk");
    expect(normalizeDomain("   TARGET.COM   ")).toBe("target.com");
  });

  it("generates an accurate plain-language summary", () => {
    const parsed = policyFormSchema.parse(validFormData);
    const summary = generatePlainLanguageSummary(parsed);
    expect(summary).toContain("$50.00");
    expect(summary).toContain("$150.00");
    expect(summary).toContain("$120.00");
    expect(summary).toContain("$200.00");
    expect(summary.toLowerCase()).toContain("denylisted");
    expect(summary).toContain("sketchy-deals.com");
  });
});
