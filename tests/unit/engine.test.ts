import { describe, it, expect } from "vitest";
import {
  evaluate,
  PolicyRuleDefinition,
  ProposalToEvaluate,
  SpendState,
} from "@/rooms/authorize/engine";

describe("Deterministic Policy Engine (src/rooms/authorize/engine.ts)", () => {
  const fixedNow = new Date("2026-11-05T12:00:00.000Z"); // 17:30 IST

  const validPolicy: PolicyRuleDefinition = {
    currency: "USD",
    per_item_max_cents: 5000, // $50.00
    cart_max_cents: 10000, // $100.00
    approval_threshold_cents: 4000, // $40.00
    daily_cap_cents: 20000, // $200.00
    merchant_mode: "ALLOWLIST_ONLY",
    merchants: ["store.apple.com", "bestbuy.com"],
    blocked_categories: ["gift_cards", "gambling", "weapons"],
    velocity_minutes: 30,
    price_max_age_seconds: 300, // 5 minutes
    valid_from: new Date("2026-01-01T00:00:00.000Z"),
    expires_at: new Date("2026-12-31T23:59:59.000Z"),
    status: "ACTIVE",
    timezone: "Asia/Kolkata",
    kill_switch: false,
  };

  const validProposal: ProposalToEvaluate = {
    workspace_id: "ws_test_42",
    currency: "USD",
    total_cents: 3000, // $30.00 (below approval threshold)
    shipping_cents: 0,
    tax_cents: 0,
    items: [
      {
        sku: "PROD-APPLE-1",
        merchant_domain: "store.apple.com",
        unit_price_cents: 3000,
        server_price_cents: 3000,
        quantity: 1,
        category: "electronics",
        price_fetched_at: fixedNow,
      },
    ],
  };

  const validSpendState: SpendState = {
    kill_switch: false,
    daily_captured_cents: 0,
    daily_reserved_cents: 0,
    recent_transactions: [],
  };

  // =========================================================================
  // Baseline Happy Path
  // =========================================================================
  it("returns ALLOW with WITHIN_ALL_LIMITS for a compliant proposal", () => {
    const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
    expect(res.decision).toBe("ALLOW");
    expect(res.reason_codes).toContain("WITHIN_ALL_LIMITS");
    expect(res.rule_results.length).toBeGreaterThan(0);
    expect(res.rule_results.every((r) => r.passed)).toBe(true);
  });

  // =========================================================================
  // Group 1: Rule 1 — Currency Validation (4 tests)
  // =========================================================================
  describe("Group 1: Currency Validation", () => {
    it("1. accepts valid USD currency", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("2. returns DENY (INVALID_CURRENCY) when currency is EUR", () => {
      const res = evaluate(
        { ...validProposal, currency: "EUR" },
        validPolicy,
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("INVALID_CURRENCY");
    });

    it("3. returns DENY (INVALID_CURRENCY) when currency is INR", () => {
      const res = evaluate(
        { ...validProposal, currency: "INR" },
        validPolicy,
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("INVALID_CURRENCY");
    });

    it("4. returns DENY (INVALID_CURRENCY) when currency is missing or empty", () => {
      const res = evaluate(
        { ...validProposal, currency: "" },
        validPolicy,
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("INVALID_CURRENCY");
    });
  });

  // =========================================================================
  // Group 2: Rule 1 — Quantity Bounds (1–10 per line) (4 tests)
  // =========================================================================
  describe("Group 2: Quantity Bounds", () => {
    it("5. allows line quantity = 1 (lower boundary)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3000,
        items: [{ ...validProposal.items[0], quantity: 1, unit_price_cents: 3000, server_price_cents: 3000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("6. allows line quantity = 10 (upper boundary)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3000,
        items: [{ ...validProposal.items[0], quantity: 10, unit_price_cents: 300, server_price_cents: 300 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("7. returns DENY (INVALID_QUANTITY) when line quantity is 0", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 0,
        items: [{ ...validProposal.items[0], quantity: 0, unit_price_cents: 3000, server_price_cents: 3000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("INVALID_QUANTITY");
    });

    it("8. returns DENY (INVALID_QUANTITY) when line quantity is 11", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3300,
        items: [{ ...validProposal.items[0], quantity: 11, unit_price_cents: 300, server_price_cents: 300 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("INVALID_QUANTITY");
    });
  });

  // =========================================================================
  // Group 3: Rule 1 — Product Integrity & SKU (3 tests)
  // =========================================================================
  describe("Group 3: Product SKU Integrity", () => {
    it("9. allows valid non-empty SKU strings", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("10. returns DENY (UNKNOWN_PRODUCT) when SKU is empty", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], sku: "" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("UNKNOWN_PRODUCT");
    });

    it("11. returns DENY (UNKNOWN_PRODUCT) when SKU is only whitespace", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], sku: "   " }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("UNKNOWN_PRODUCT");
    });
  });

  // =========================================================================
  // Group 4: Rule 1 — Server-Side Price Equality (4 tests)
  // =========================================================================
  describe("Group 4: Server Price Equality", () => {
    it("12. allows items where unit price matches server price", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("13. returns DENY (ITEM_PRICE_MISMATCH) when proposal price is lower than server price (Attack Lab A3)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 2000,
        items: [{ ...validProposal.items[0], unit_price_cents: 2000, server_price_cents: 3000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("ITEM_PRICE_MISMATCH");
    });

    it("14. returns DENY (ITEM_PRICE_MISMATCH) when proposal price is higher than server price", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3500,
        items: [{ ...validProposal.items[0], unit_price_cents: 3500, server_price_cents: 3000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("ITEM_PRICE_MISMATCH");
    });

    it("15. returns DENY (ITEM_PRICE_MISMATCH) when price is negative", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: -3000,
        items: [{ ...validProposal.items[0], unit_price_cents: -3000, server_price_cents: 3000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("ITEM_PRICE_MISMATCH");
    });
  });

  // =========================================================================
  // Group 5: Rule 1 — Recomputed Total Equality (4 tests)
  // =========================================================================
  describe("Group 5: Recomputed Total Equality", () => {
    it("16. allows proposals where recomputed sum matches total_cents with shipping and tax", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        shipping_cents: 500,
        tax_cents: 250,
        total_cents: 3750, // 3000 + 500 + 250
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("17. returns DENY (TOTAL_MISMATCH) when total is 1 cent below recomputed sum", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 2999, // actual items sum = 3000
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("TOTAL_MISMATCH");
    });

    it("18. returns DENY (TOTAL_MISMATCH) when total is 1 cent above recomputed sum", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3001, // actual items sum = 3000
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("TOTAL_MISMATCH");
    });

    it("19. returns DENY (TOTAL_MISMATCH) for forged proposal total (Attack Lab A2: $9.99 for $99.90 items)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 999, // Claimed total: $9.99
        items: [
          {
            ...validProposal.items[0],
            unit_price_cents: 9990, // Actual items: $99.90
            server_price_cents: 9990,
            quantity: 1,
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("TOTAL_MISMATCH");
    });
  });

  // =========================================================================
  // Group 6: Rule 1 — Price Freshness & Stale Price (4 tests)
  // =========================================================================
  describe("Group 6: Price Freshness", () => {
    it("20. allows newly fetched price (age = 0s)", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("21. allows price fetched exactly at price_max_age_seconds (boundary: 300s)", () => {
      const exactBoundary = new Date(fixedNow.getTime() - 300 * 1000);
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], price_fetched_at: exactBoundary }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("22. returns DENY (PRICE_STALE) when price is 1 second past price_max_age_seconds (boundary: 301s)", () => {
      const expiredBoundary = new Date(fixedNow.getTime() - 301 * 1000);
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], price_fetched_at: expiredBoundary }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("PRICE_STALE");
    });

    it("23. returns DENY (PRICE_STALE) when price was fetched days ago", () => {
      const daysAgo = new Date(fixedNow.getTime() - 86400 * 1000 * 3);
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], price_fetched_at: daysAgo }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("PRICE_STALE");
    });
  });

  // =========================================================================
  // Group 7: Rule 2 — Kill Switch (3 tests)
  // =========================================================================
  describe("Group 7: Kill Switch", () => {
    it("24. allows proposals when kill switch is off", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("25. returns DENY (KILL_SWITCH_ON) immediately when spendState kill switch is on", () => {
      const res = evaluate(
        validProposal,
        validPolicy,
        { ...validSpendState, kill_switch: true },
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("KILL_SWITCH_ON");
    });

    it("26. returns DENY (KILL_SWITCH_ON) when policy-level kill switch is on", () => {
      const res = evaluate(
        validProposal,
        { ...validPolicy, kill_switch: true },
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("KILL_SWITCH_ON");
    });
  });

  // =========================================================================
  // Group 8: Rule 2 — Policy Status & Lifecycle (6 tests)
  // =========================================================================
  describe("Group 8: Policy Status & Lifecycle", () => {
    it("27. returns DENY (POLICY_MISSING) when policy is null or undefined", () => {
      const res = evaluate(validProposal, null, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_MISSING");
    });

    it("28. returns DENY (POLICY_MISSING) when policy status is DRAFT", () => {
      const res = evaluate(
        validProposal,
        { ...validPolicy, status: "DRAFT" },
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_MISSING");
    });

    it("29. returns DENY (POLICY_PAUSED) when policy status is PAUSED", () => {
      const res = evaluate(
        validProposal,
        { ...validPolicy, status: "PAUSED" },
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_PAUSED");
    });

    it("30. returns DENY (POLICY_REVOKED) when policy status is REVOKED", () => {
      const res = evaluate(
        validProposal,
        { ...validPolicy, status: "REVOKED" },
        validSpendState,
        fixedNow
      );
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_REVOKED");
    });

    it("31. returns DENY (POLICY_EXPIRED) when current time is before policy valid_from", () => {
      const futureStartPolicy = {
        ...validPolicy,
        valid_from: new Date("2026-12-01T00:00:00.000Z"),
      };
      const res = evaluate(validProposal, futureStartPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_EXPIRED");
    });

    it("32. returns DENY (POLICY_EXPIRED) when current time is after policy expires_at", () => {
      const pastExpirePolicy = {
        ...validPolicy,
        expires_at: new Date("2026-10-01T00:00:00.000Z"),
      };
      const res = evaluate(validProposal, pastExpirePolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("POLICY_EXPIRED");
    });
  });

  // =========================================================================
  // Group 9: Rule 3 — Merchant Modes (8 tests)
  // =========================================================================
  describe("Group 9: Merchant Modes", () => {
    it("33. ALLOWLIST_ONLY: allows merchant present in allowlist", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("34. ALLOWLIST_ONLY: returns DENY (MERCHANT_NOT_ALLOWED) when merchant is not in allowlist", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], merchant_domain: "unknown-store.com" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("MERCHANT_NOT_ALLOWED");
    });

    it("35. ALLOWLIST_ONLY: normalizes case and domain correctly", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], merchant_domain: "STORE.APPLE.COM" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("36. DENYLIST: allows merchant not in denylist", () => {
      const denylistPolicy: PolicyRuleDefinition = {
        ...validPolicy,
        merchant_mode: "DENYLIST",
        merchants: ["banned-merchant.com"],
      };
      const res = evaluate(validProposal, denylistPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("37. DENYLIST: returns DENY (MERCHANT_DENYLISTED) when merchant is in denylist", () => {
      const denylistPolicy: PolicyRuleDefinition = {
        ...validPolicy,
        merchant_mode: "DENYLIST",
        merchants: ["store.apple.com"],
      };
      const res = evaluate(validProposal, denylistPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("MERCHANT_DENYLISTED");
    });

    it("38. ANY_WITH_APPROVAL: returns ALLOW when merchant is in pre-approved list", () => {
      const approvalPolicy: PolicyRuleDefinition = {
        ...validPolicy,
        merchant_mode: "ANY_WITH_APPROVAL",
        merchants: ["store.apple.com"],
      };
      const res = evaluate(validProposal, approvalPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("39. ANY_WITH_APPROVAL: returns REQUIRE_APPROVAL (MERCHANT_NEEDS_APPROVAL) for novel merchant", () => {
      const approvalPolicy: PolicyRuleDefinition = {
        ...validPolicy,
        merchant_mode: "ANY_WITH_APPROVAL",
        merchants: ["store.apple.com"],
      };
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], merchant_domain: "newmerchant.com" }],
      };
      const res = evaluate(p, approvalPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("MERCHANT_NEEDS_APPROVAL");
    });

    it("40. DENYLIST: returns DENY (MERCHANT_DENYLISTED) if any item in a multi-item cart is denylisted", () => {
      const denylistPolicy: PolicyRuleDefinition = {
        ...validPolicy,
        merchant_mode: "DENYLIST",
        merchants: ["shady.com"],
      };
      const multiCart: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 5000,
        items: [
          validProposal.items[0], // store.apple.com
          {
            sku: "SHADY-1",
            merchant_domain: "shady.com",
            unit_price_cents: 2000,
            server_price_cents: 2000,
            quantity: 1,
            category: "electronics",
            price_fetched_at: fixedNow,
          },
        ],
      };
      const res = evaluate(multiCart, denylistPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("MERCHANT_DENYLISTED");
    });
  });

  // =========================================================================
  // Group 10: Rule 4 — Categories (Blocked & Unknown) (5 tests)
  // =========================================================================
  describe("Group 10: Category Rules", () => {
    it("41. allows safe permitted categories", () => {
      const res = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
    });

    it("42. returns DENY (CATEGORY_BLOCKED) when category is 'gift_cards'", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], category: "gift_cards" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("CATEGORY_BLOCKED");
    });

    it("43. returns DENY (CATEGORY_BLOCKED) when category is 'weapons' or 'gambling'", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], category: "weapons" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("CATEGORY_BLOCKED");
    });

    it("44. returns REQUIRE_APPROVAL (CATEGORY_UNKNOWN) when category is missing/undefined", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], category: undefined }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("CATEGORY_UNKNOWN");
    });

    it("45. returns REQUIRE_APPROVAL (CATEGORY_UNKNOWN) when category is an empty string", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        items: [{ ...validProposal.items[0], category: "" }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("CATEGORY_UNKNOWN");
    });
  });

  // =========================================================================
  // Group 11: Rule 5 — Per-Item Max Cap Boundaries (4 tests)
  // =========================================================================
  describe("Group 11: Per-Item Limit Boundaries ($50.00 / 5000 cents)", () => {
    it("46. allows item price 1 cent below per-item cap ($49.99 / 4999 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 4999,
        items: [{ ...validProposal.items[0], unit_price_cents: 4999, server_price_cents: 4999 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      // Notice: 4999 is above approval_threshold_cents (4000), so it requires approval, but does NOT deny on per-item cap
      expect(res.reason_codes).not.toContain("OVER_PER_ITEM_CAP");
    });

    it("47. allows item price equal to per-item cap ($50.00 / 5000 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 5000,
        items: [{ ...validProposal.items[0], unit_price_cents: 5000, server_price_cents: 5000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.reason_codes).not.toContain("OVER_PER_ITEM_CAP");
    });

    it("48. returns DENY (OVER_PER_ITEM_CAP) when item price is 1 cent above per-item cap ($50.01 / 5001 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 5001,
        items: [{ ...validProposal.items[0], unit_price_cents: 5001, server_price_cents: 5001 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("OVER_PER_ITEM_CAP");
    });

    it("49. returns DENY (OVER_PER_ITEM_CAP) when second item in a multi-item cart exceeds cap", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 7500,
        items: [
          validProposal.items[0], // $30.00 (within limit)
          {
            sku: "EXPENSIVE-1",
            merchant_domain: "store.apple.com",
            unit_price_cents: 5500, // $55.00 > $50.00 cap!
            server_price_cents: 5500,
            quantity: 1,
            category: "electronics",
            price_fetched_at: fixedNow,
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("OVER_PER_ITEM_CAP");
    });
  });

  // =========================================================================
  // Group 12: Rule 5 — Cart Max Cap Boundaries (3 tests)
  // =========================================================================
  describe("Group 12: Cart Max Cap Boundaries ($100.00 / 10000 cents)", () => {
    it("50. allows cart total 1 cent below cart cap ($99.99 / 9999 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 9999,
        items: [
          { ...validProposal.items[0], unit_price_cents: 4999, server_price_cents: 4999 },
          {
            sku: "ITEM-2",
            merchant_domain: "store.apple.com",
            unit_price_cents: 5000,
            server_price_cents: 5000,
            quantity: 1,
            category: "electronics",
            price_fetched_at: fixedNow,
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.reason_codes).not.toContain("OVER_CART_CAP");
    });

    it("51. allows cart total exactly equal to cart cap ($100.00 / 10000 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 10000,
        items: [
          { ...validProposal.items[0], unit_price_cents: 5000, server_price_cents: 5000 },
          {
            sku: "ITEM-2",
            merchant_domain: "store.apple.com",
            unit_price_cents: 5000,
            server_price_cents: 5000,
            quantity: 1,
            category: "electronics",
            price_fetched_at: fixedNow,
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.reason_codes).not.toContain("OVER_CART_CAP");
    });

    it("52. returns DENY (OVER_CART_CAP) when cart total is 1 cent above cap ($100.01 / 10001 cents) (Attack Lab A1)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 10001,
        items: [
          { ...validProposal.items[0], unit_price_cents: 5000, server_price_cents: 5000 },
          {
            sku: "ITEM-2",
            merchant_domain: "store.apple.com",
            unit_price_cents: 5001,
            server_price_cents: 5001,
            quantity: 1,
            category: "electronics",
            price_fetched_at: fixedNow,
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("OVER_CART_CAP");
    });
  });

  // =========================================================================
  // Group 13: Rule 6 — Daily Cap & Asia/Kolkata Calendar Day (6 tests)
  // =========================================================================
  describe("Group 13: Daily Cap & Asia/Kolkata Calendar Day ($200.00 / 20000 cents)", () => {
    it("53. allows spend when (captured + reserved + cart) is 1 cent below daily cap ($199.99)", () => {
      const spend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 10000,
        daily_reserved_cents: 6999, // 10000 + 6999 + 3000 = 19999
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.reason_codes).not.toContain("DAILY_CAP_EXCEEDED");
    });

    it("54. allows spend when (captured + reserved + cart) equals daily cap ($200.00)", () => {
      const spend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 10000,
        daily_reserved_cents: 7000, // 10000 + 7000 + 3000 = 20000
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.reason_codes).not.toContain("DAILY_CAP_EXCEEDED");
    });

    it("55. returns DENY (DAILY_CAP_EXCEEDED) when (captured + reserved + cart) is 1 cent above daily cap ($200.01)", () => {
      const spend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 10000,
        daily_reserved_cents: 7001, // 10000 + 7001 + 3000 = 20001
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("DAILY_CAP_EXCEEDED");
    });

    it("56. includes pending spend reservations in daily cap calculation", () => {
      const spend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 0,
        daily_reserved_cents: 18000, // 18000 reserved + 3000 cart = 21000 > 20000
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("DAILY_CAP_EXCEEDED");
    });

    it("57. evaluates daily cap boundary at 23:59:59 Asia/Kolkata (belongs to current day)", () => {
      // 23:59:59 IST = 18:29:59 UTC
      const endOfDayIST = new Date("2026-11-05T18:29:59.000Z");
      const spend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 19000, // 19000 + 3000 = 22000 > 20000
      };
      const res = evaluate(validProposal, validPolicy, spend, endOfDayIST);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("DAILY_CAP_EXCEEDED");
    });

    it("58. resets daily spend bucket at midnight (00:00:01 Asia/Kolkata) on a fresh calendar day", () => {
      // 00:00:01 IST on Nov 6 = 18:30:01 UTC on Nov 5
      const startOfNextDayIST = new Date("2026-11-05T18:30:01.000Z");
      // Fresh proposal with up-to-date fetched price for the new time
      const freshProposal: ProposalToEvaluate = {
        ...validProposal,
        items: [
          {
            ...validProposal.items[0],
            price_fetched_at: startOfNextDayIST,
          },
        ],
      };
      // When a fresh day starts, the daily spend state for the new calendar day is zeroed
      const freshDaySpend: SpendState = {
        ...validSpendState,
        daily_captured_cents: 0,
        daily_reserved_cents: 0,
      };
      const res = evaluate(freshProposal, validPolicy, freshDaySpend, startOfNextDayIST);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason_codes).not.toContain("DAILY_CAP_EXCEEDED");
    });
  });

  // =========================================================================
  // Group 14: Rule 7 — Velocity Duplicate Window (4 tests)
  // =========================================================================
  describe("Group 14: Velocity Duplicate Window", () => {
    it("59. allows same merchant+SKU if previous purchase occurred outside velocity window (e.g. 31m ago)", () => {
      const pastTime = new Date(fixedNow.getTime() - 31 * 60 * 1000);
      const spend: SpendState = {
        ...validSpendState,
        recent_transactions: [
          {
            merchant_domain: "store.apple.com",
            sku: "PROD-APPLE-1",
            timestamp: pastTime,
          },
        ],
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.reason_codes).not.toContain("VELOCITY_DUPLICATE_WINDOW");
    });

    it("60. returns REQUIRE_APPROVAL (VELOCITY_DUPLICATE_WINDOW) for same merchant+SKU within velocity window (e.g. 10m ago)", () => {
      const recentTime = new Date(fixedNow.getTime() - 10 * 60 * 1000);
      const spend: SpendState = {
        ...validSpendState,
        recent_transactions: [
          {
            merchant_domain: "store.apple.com",
            sku: "PROD-APPLE-1",
            timestamp: recentTime,
          },
        ],
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("VELOCITY_DUPLICATE_WINDOW");
    });

    it("61. allows different SKU from the same merchant within velocity window", () => {
      const recentTime = new Date(fixedNow.getTime() - 10 * 60 * 1000);
      const spend: SpendState = {
        ...validSpendState,
        recent_transactions: [
          {
            merchant_domain: "store.apple.com",
            sku: "DIFFERENT-SKU-99",
            timestamp: recentTime,
          },
        ],
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.reason_codes).not.toContain("VELOCITY_DUPLICATE_WINDOW");
    });

    it("62. allows same SKU from a different merchant within velocity window", () => {
      const recentTime = new Date(fixedNow.getTime() - 10 * 60 * 1000);
      const spend: SpendState = {
        ...validSpendState,
        recent_transactions: [
          {
            merchant_domain: "bestbuy.com",
            sku: "PROD-APPLE-1",
            timestamp: recentTime,
          },
        ],
      };
      const res = evaluate(validProposal, validPolicy, spend, fixedNow);
      expect(res.reason_codes).not.toContain("VELOCITY_DUPLICATE_WINDOW");
    });
  });

  // =========================================================================
  // Group 15: Rule 8 — Approval Threshold Boundaries ($40.00 / 4000 cents) (3 tests)
  // =========================================================================
  describe("Group 15: Approval Threshold Boundaries", () => {
    it("63. returns ALLOW (WITHIN_ALL_LIMITS) when cart is 1 cent below approval threshold ($39.99 / 3999 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 3999,
        items: [{ ...validProposal.items[0], unit_price_cents: 3999, server_price_cents: 3999 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason_codes).toContain("WITHIN_ALL_LIMITS");
    });

    it("64. returns ALLOW (WITHIN_ALL_LIMITS) when cart is exactly equal to approval threshold ($40.00 / 4000 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 4000,
        items: [{ ...validProposal.items[0], unit_price_cents: 4000, server_price_cents: 4000 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason_codes).toContain("WITHIN_ALL_LIMITS");
    });

    it("65. returns REQUIRE_APPROVAL (OVER_APPROVAL_THRESHOLD) when cart is 1 cent above threshold ($40.01 / 4001 cents)", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 4001,
        items: [{ ...validProposal.items[0], unit_price_cents: 4001, server_price_cents: 4001 }],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("OVER_APPROVAL_THRESHOLD");
    });
  });

  // =========================================================================
  // Group 16: Evaluation Order, Precedence & Explainable Results (4 tests)
  // =========================================================================
  describe("Group 16: Evaluation Order & Precedence", () => {
    it("66. evaluates and reports results for all rules, not just the first failure", () => {
      // Multiple failures: bad currency, bad price, over cart cap
      const multiFailProposal: ProposalToEvaluate = {
        ...validProposal,
        currency: "EUR",
        total_cents: 15000, // over $100 cart cap
        items: [
          {
            ...validProposal.items[0],
            unit_price_cents: 15000,
            server_price_cents: 10000, // price mismatch
          },
        ],
      };
      const res = evaluate(multiFailProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.rule_results.length).toBeGreaterThanOrEqual(8);
      // Verify individual rule reports
      expect(res.reason_codes).toEqual(
        expect.arrayContaining(["INVALID_CURRENCY", "ITEM_PRICE_MISMATCH", "OVER_CART_CAP"])
      );
    });

    it("67. precedence: DENY beats REQUIRE_APPROVAL", () => {
      // Cart is over approval threshold ($45 > $40 -> REQUIRE_APPROVAL),
      // but also over item cap ($55 > $50 -> DENY)
      const mixedProposal: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 5500,
        items: [
          {
            ...validProposal.items[0],
            unit_price_cents: 5500,
            server_price_cents: 5500,
          },
        ],
      };
      const res = evaluate(mixedProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("OVER_PER_ITEM_CAP");
      expect(res.reason_codes).toContain("OVER_APPROVAL_THRESHOLD");
    });

    it("68. precedence: REQUIRE_APPROVAL beats ALLOW", () => {
      const approvalProposal: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 4500, // over $40 threshold
        items: [
          {
            ...validProposal.items[0],
            unit_price_cents: 4500,
            server_price_cents: 4500,
          },
        ],
      };
      const res = evaluate(approvalProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("OVER_APPROVAL_THRESHOLD");
    });

    it("69. aggregates all distinct triggered reason codes in reason_codes array", () => {
      const p: ProposalToEvaluate = {
        ...validProposal,
        total_cents: 4500, // over threshold ($40) -> OVER_APPROVAL_THRESHOLD
        items: [
          {
            ...validProposal.items[0],
            unit_price_cents: 4500,
            server_price_cents: 4500,
            category: undefined, // missing category -> CATEGORY_UNKNOWN
          },
        ],
      };
      const res = evaluate(p, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("REQUIRE_APPROVAL");
      expect(res.reason_codes).toContain("OVER_APPROVAL_THRESHOLD");
      expect(res.reason_codes).toContain("CATEGORY_UNKNOWN");
    });
  });

  // =========================================================================
  // Group 17: Rule 9 — Pure Function & Fail-Closed Safety (2 tests)
  // =========================================================================
  describe("Group 17: Pure Function & Fail Closed Safety", () => {
    it("70. returns DENY (EVAL_ERROR) without throwing when an unexpected internal evaluation exception occurs", () => {
      const throwingProposal = {
        get currency(): string {
          throw new Error("Unexpected memory corruption in getter");
        },
      } as any;

      expect(() =>
        evaluate(throwingProposal, validPolicy, validSpendState, fixedNow)
      ).not.toThrow();

      const res = evaluate(throwingProposal, validPolicy, validSpendState, fixedNow);
      expect(res.decision).toBe("DENY");
      expect(res.reason_codes).toContain("EVAL_ERROR");
      expect(res.rule_results.some((r) => r.rule === "system_eval_safety")).toBe(true);
    });

    it("71. pure function guarantee: repeated execution with identical arguments produces identical results without mutating inputs", () => {
      const proposalSnapshot = {
        workspace_id: validProposal.workspace_id,
        currency: validProposal.currency,
        total_cents: validProposal.total_cents,
        shipping_cents: validProposal.shipping_cents,
        tax_cents: validProposal.tax_cents,
        itemsCount: validProposal.items.length,
      };

      const res1 = evaluate(validProposal, validPolicy, validSpendState, fixedNow);
      const res2 = evaluate(validProposal, validPolicy, validSpendState, fixedNow);

      expect(res1).toEqual(res2);
      expect({
        workspace_id: validProposal.workspace_id,
        currency: validProposal.currency,
        total_cents: validProposal.total_cents,
        shipping_cents: validProposal.shipping_cents,
        tax_cents: validProposal.tax_cents,
        itemsCount: validProposal.items.length,
      }).toEqual(proposalSnapshot);
    });
  });
});
