import { computeProposalHash } from "@/lib/canonical";
import { getSeededProducts } from "./catalog/seeded";
import { Product } from "./catalog/types";
import { EvaluationResult, ProposalItem, ProposalToEvaluate } from "@/rooms/authorize/types";

export interface CreateProposalItemInput {
  sku: string;
  quantity: number;
  unit_price_cents?: number; // Ignored: prices are strictly recomputed on the server
}

export interface BuildProposalInput {
  workspaceId: string;
  items: CreateProposalItemInput[];
  intentId?: string;
  catalog?: Product[];
}

export interface BuiltProposalOutput {
  proposal: {
    id: string;
    workspace_id: string;
    intent_id?: string;
    items: ProposalItem[];
    total_cents: number;
    currency: "USD";
    proposal_hash: string;
    state: string;
  };
  proposalToEvaluate: ProposalToEvaluate;
}

export interface DecisionCardData {
  verdict: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  reasonCodes: string[];
  ruleResults: Array<{
    rule: string;
    passed: boolean;
    decision: string;
    message: string;
  }>;
  proposalHash: string;
  evaluatedAt: string;
}

/**
 * Builds a proposal from item selections.
 *
 * Golden Rule 5 (AGENTS.md):
 * Totals and prices are always recomputed on the server from server-fetched data.
 * Model output and client input are never trusted for money.
 */
export function buildProposalFromItems(input: BuildProposalInput): BuiltProposalOutput {
  const { workspaceId, items, intentId } = input;
  const catalog = input.catalog || getSeededProducts();

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Proposal must contain at least one item.");
  }

  const proposalId = `prop_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const proposalItems: ProposalItem[] = [];
  let totalCents = 0;

  for (let index = 0; index < items.length; index++) {
    const itemInput = items[index];
    if (!itemInput.sku || typeof itemInput.sku !== "string") {
      throw new Error(`Item at index ${index} is missing a valid SKU.`);
    }

    if (
      !Number.isInteger(itemInput.quantity) ||
      itemInput.quantity <= 0 ||
      itemInput.quantity > 99
    ) {
      throw new Error(
        `Item at index ${index} has invalid quantity (${itemInput.quantity}). Quantity must be an integer between 1 and 99.`
      );
    }

    // Lookup strictly against server product catalog
    const product = catalog.find((p) => p.sku === itemInput.sku);
    if (!product) {
      throw new Error(`Unknown product SKU: ${itemInput.sku}`);
    }

    // Server-verified prices
    const serverPriceCents = product.price_cents;
    const itemTotalCents = serverPriceCents * itemInput.quantity;
    totalCents += itemTotalCents;

    proposalItems.push({
      sku: product.sku,
      title: product.title,
      name: product.title,
      description: product.description,
      merchant_domain: product.merchant_domain || product.merchant,
      unit_price_cents: serverPriceCents,
      server_price_cents: serverPriceCents,
      quantity: itemInput.quantity,
      category: product.category,
      price_fetched_at: product.fetched_at || new Date().toISOString(),
      image_url: product.image_url,
    });
  }

  // PRD §6.4: Proposal hash computation (RFC 8785 Canonical JSON of material fields)
  const proposalHash = computeProposalHash({
    workspace_id: workspaceId,
    items: proposalItems.map((p) => ({
      sku: p.sku,
      merchant_domain: p.merchant_domain,
      unit_price_cents: p.unit_price_cents,
      quantity: p.quantity,
    })),
    currency: "USD",
    total_cents: totalCents,
  });

  const proposalToEvaluate: ProposalToEvaluate = {
    workspace_id: workspaceId,
    items: proposalItems,
    currency: "USD",
    total_cents: totalCents,
  };

  return {
    proposal: {
      id: proposalId,
      workspace_id: workspaceId,
      intent_id: intentId,
      items: proposalItems,
      total_cents: totalCents,
      currency: "USD",
      proposal_hash: proposalHash,
      state: "DRAFT",
    },
    proposalToEvaluate,
  };
}

/**
 * Maps pure evaluation result and proposal hash into structured DecisionCard data (PRD §10.2).
 */
export function formatDecisionCard(
  evaluation: EvaluationResult,
  proposalHash: string,
  now = new Date()
): DecisionCardData {
  return {
    verdict: evaluation.decision,
    reasonCodes: evaluation.reason_codes,
    ruleResults: evaluation.rule_results.map((r) => ({
      rule: r.rule,
      passed: r.passed,
      decision: r.decision,
      message: r.message,
    })),
    proposalHash,
    evaluatedAt: now.toISOString(),
  };
}
