import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluate, PolicyRuleDefinition, ProposalToEvaluate, SpendState } from "@/rooms/authorize/engine";
import { canExecute } from "@/rooms/authorize/guard";
import { computeProposalHash, ProposalPayloadInput } from "@/lib/canonical";

describe("Fast-Check Property-Based Tests", () => {
  // Arbitrary generator for random proposal items
  const arbitraryItem = fc.record({
    sku: fc.stringMatching(/^[A-Z0-9_-]{3,10}$/),
    merchant_domain: fc.constantFrom("store.apple.com", "bestbuy.com", "amazon.com", "target.com"),
    unit_price_cents: fc.integer({ min: 1, max: 20000 }),
    server_price_cents: fc.integer({ min: 1, max: 20000 }),
    quantity: fc.integer({ min: 1, max: 15 }),
    category: fc.constantFrom("electronics", "books", "clothing", "gift_cards", "weapons", undefined),
    price_fetched_at: fc.date({
      min: new Date("2026-11-05T00:00:00.000Z"),
      max: new Date("2026-11-05T12:00:00.000Z"),
    }),
  });

  // Arbitrary generator for random proposals
  const arbitraryProposal = fc.record({
    workspace_id: fc.stringMatching(/^[a-z0-9_]{5,15}$/),
    currency: fc.constantFrom("USD", "EUR", "GBP", "INR"),
    total_cents: fc.integer({ min: 0, max: 50000 }),
    shipping_cents: fc.integer({ min: 0, max: 2000 }),
    tax_cents: fc.integer({ min: 0, max: 2000 }),
    items: fc.array(arbitraryItem, { minLength: 1, maxLength: 5 }),
  });

  // Arbitrary generator for random policies
  const arbitraryPolicy = fc.record({
    currency: fc.constant("USD" as const),
    per_item_max_cents: fc.integer({ min: 1000, max: 10000 }),
    cart_max_cents: fc.integer({ min: 5000, max: 30000 }),
    approval_threshold_cents: fc.integer({ min: 1000, max: 15000 }),
    daily_cap_cents: fc.integer({ min: 10000, max: 50000 }),
    merchant_mode: fc.constantFrom("ALLOWLIST_ONLY" as const, "DENYLIST" as const, "ANY_WITH_APPROVAL" as const),
    merchants: fc.constant(["store.apple.com", "bestbuy.com"]),
    blocked_categories: fc.constant(["gift_cards", "weapons", "gambling"]),
    velocity_minutes: fc.integer({ min: 5, max: 60 }),
    price_max_age_seconds: fc.integer({ min: 60, max: 600 }),
    valid_from: fc.constant(new Date("2026-01-01T00:00:00.000Z")),
    expires_at: fc.constant(new Date("2026-12-31T23:59:59.000Z")),
    status: fc.constantFrom("ACTIVE" as const, "PAUSED" as const, "REVOKED" as const, "DRAFT" as const),
    kill_switch: fc.boolean(),
  });

  // Arbitrary generator for random spend states
  const arbitrarySpendState = fc.record({
    kill_switch: fc.boolean(),
    daily_captured_cents: fc.integer({ min: 0, max: 40000 }),
    daily_reserved_cents: fc.integer({ min: 0, max: 20000 }),
    recent_transactions: fc.constant([]),
  });

  const fixedNow = new Date("2026-11-05T12:00:00.000Z");

  // =========================================================================
  // Property 1: If decision is DENY then canExecute returns false
  // =========================================================================
  it("Property 1: for random proposals and policies, if the decision is DENY then canExecute returns false", () => {
    fc.assert(
      fc.property(
        arbitraryProposal,
        arbitraryPolicy,
        arbitrarySpendState,
        (proposal, policy, spendState) => {
          const evalResult = evaluate(
            proposal as unknown as ProposalToEvaluate,
            policy as unknown as PolicyRuleDefinition,
            spendState as unknown as SpendState,
            fixedNow
          );

          if (evalResult.decision === "DENY") {
            // Under NO circumstance can a DENY proceed to execution, even if human approved
            expect(canExecute(evalResult, false)).toBe(false);
            expect(canExecute(evalResult, true)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // =========================================================================
  // Property 2: Proposal hash is stable under key reordering and item permutations
  // =========================================================================
  it("Property 2: proposal hash is strictly invariant under key reordering and item order permutation", () => {
    // Generate valid canonical proposals
    const canonicalItemGen = fc.record({
      sku: fc.stringMatching(/^[A-Z0-9-]{3,8}$/),
      merchant_domain: fc.constantFrom("store.apple.com", "bestbuy.com", "target.com"),
      unit_price_cents: fc.integer({ min: 100, max: 5000 }),
      quantity: fc.integer({ min: 1, max: 5 }),
    });

    const canonicalProposalGen = fc.record({
      workspace_id: fc.constant("ws_prop_test"),
      currency: fc.constant("USD"),
      shipping_cents: fc.integer({ min: 0, max: 500 }),
      tax_cents: fc.integer({ min: 0, max: 500 }),
      checkout_terms_version: fc.constant("1.0"),
      items: fc.array(canonicalItemGen, { minLength: 1, maxLength: 4 }),
    }).map((p) => {
      // Recompute total properly so structure is valid
      const itemsSum = p.items.reduce((acc, i) => acc + i.unit_price_cents * i.quantity, 0);
      return {
        ...p,
        total_cents: itemsSum + p.shipping_cents + p.tax_cents,
      };
    });

    fc.assert(
      fc.property(canonicalProposalGen, (proposal) => {
        const hashOriginal = computeProposalHash(proposal as ProposalPayloadInput);

        // Permute items array order
        const permutedItems = [...proposal.items].reverse();

        // Inject arbitrary untrusted metadata and scramble keys
        const scrambledProposal: Record<string, unknown> = {
          untrusted_comment: "random prompt injection",
          shipping_cents: proposal.shipping_cents,
          items: permutedItems.map((item) => ({
            extra_description: "untrusted product description",
            quantity: item.quantity,
            title: "untrusted product title",
            unit_price_cents: item.unit_price_cents,
            merchant_domain: item.merchant_domain,
            sku: item.sku,
          })),
          tax_cents: proposal.tax_cents,
          workspace_id: proposal.workspace_id,
          total_cents: proposal.total_cents,
          checkout_terms_version: proposal.checkout_terms_version,
          currency: proposal.currency,
        };

        const hashScrambled = computeProposalHash(scrambledProposal as ProposalPayloadInput);

        expect(hashOriginal).toBe(hashScrambled);
      }),
      { numRuns: 150 }
    );
  });
});
