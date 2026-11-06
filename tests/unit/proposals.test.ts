import { describe, expect, it } from "vitest";
import { buildProposalFromItems } from "@/rooms/propose/proposalService";
import { computeProposalHash } from "@/lib/canonical";
import { getSeededProducts } from "@/rooms/propose/catalog/seeded";

describe("Proposal Creation & Server Price Recomputation (PRD §6.4, Golden Rule 5)", () => {
  const workspaceId = "ws_test_proposal_unit";
  const catalog = getSeededProducts();
  const keyboard = catalog.find((p) => p.sku === "SKU-KEYBOARD-01")!;
  const mouse = catalog.find((p) => p.sku === "SKU-MOUSE-01")!;

  it("strictly recomputes prices and totals on the server, discarding client-provided prices", () => {
    // Malicious client claims keyboard is 100 cents ($1.00) and mouse is 50 cents ($0.50)
    const clientItems = [
      { sku: "SKU-KEYBOARD-01", quantity: 1, unit_price_cents: 100 },
      { sku: "SKU-MOUSE-01", quantity: 2, unit_price_cents: 50 },
    ];

    const result = buildProposalFromItems({
      workspaceId,
      items: clientItems,
    });

    // True server prices: keyboard = 8499, mouse = 9999
    // Expected total = (8499 * 1) + (9999 * 2) = 8499 + 19998 = 28497 cents
    expect(result.proposal.total_cents).toBe(28497);
    expect(result.proposal.items[0].unit_price_cents).toBe(8499);
    expect(result.proposal.items[0].server_price_cents).toBe(8499);
    expect(result.proposal.items[1].unit_price_cents).toBe(9999);
    expect(result.proposal.items[1].server_price_cents).toBe(9999);
  });

  it("computes the exact RFC 8785 proposal hash matching computeProposalHash", () => {
    const clientItems = [
      { sku: "SKU-KEYBOARD-01", quantity: 1 },
      { sku: "SKU-MOUSE-01", quantity: 1 },
    ];

    const result = buildProposalFromItems({
      workspaceId,
      items: clientItems,
    });

    const expectedHash = computeProposalHash({
      workspace_id: workspaceId,
      items: [
        {
          sku: "SKU-KEYBOARD-01",
          merchant_domain: keyboard.merchant_domain,
          unit_price_cents: keyboard.price_cents,
          quantity: 1,
        },
        {
          sku: "SKU-MOUSE-01",
          merchant_domain: mouse.merchant_domain,
          unit_price_cents: mouse.price_cents,
          quantity: 1,
        },
      ],
      currency: "USD",
      total_cents: keyboard.price_cents + mouse.price_cents,
    });

    expect(result.proposal.proposal_hash).toBe(expectedHash);
  });

  it("rejects invalid, zero, or negative quantities", () => {
    expect(() =>
      buildProposalFromItems({
        workspaceId,
        items: [{ sku: "SKU-KEYBOARD-01", quantity: 0 }],
      })
    ).toThrow(/quantity/i);

    expect(() =>
      buildProposalFromItems({
        workspaceId,
        items: [{ sku: "SKU-KEYBOARD-01", quantity: -2 }],
      })
    ).toThrow(/quantity/i);

    expect(() =>
      buildProposalFromItems({
        workspaceId,
        items: [{ sku: "SKU-KEYBOARD-01", quantity: 1.5 }],
      })
    ).toThrow(/quantity/i);
  });

  it("throws for unknown SKU not found in server catalog", () => {
    expect(() =>
      buildProposalFromItems({
        workspaceId,
        items: [{ sku: "SKU-NONEXISTENT-999", quantity: 1 }],
      })
    ).toThrow(/unknown product sku/i);
  });
});
