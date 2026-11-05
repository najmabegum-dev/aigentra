import canonicalize from "canonicalize";
import crypto from "node:crypto";
import { assertIntegerCents, validateCurrency } from "./money";

export interface ProposalItemInput {
  sku: string;
  merchant_domain: string;
  unit_price_cents: number;
  quantity: number;
  // Untrusted display fields that must be ignored during hashing:
  name?: string;
  title?: string;
  description?: string;
  image_url?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ProposalPayloadInput {
  workspace_id: string;
  items: ProposalItemInput[];
  currency: string;
  total_cents: number;
  shipping_cents?: number;
  tax_cents?: number;
  checkout_terms_version?: string;
  // Untrusted metadata fields that must be ignored during hashing:
  id?: string;
  created_at?: unknown;
  intent_id?: string;
  state?: string;
  [key: string]: unknown;
}

export interface CanonicalMaterialItem {
  merchant_domain: string;
  quantity: number;
  sku: string;
  unit_price_cents: number;
}

export interface CanonicalMaterialPayload {
  checkout_terms_version: string;
  currency: "USD";
  items: CanonicalMaterialItem[];
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  workspace_id: string;
}

/**
 * Computes RFC 8785 canonical JSON string for any JavaScript object.
 */
export function canonicalJson(data: unknown): string {
  const result = canonicalize(data);
  if (result === undefined) {
    throw new Error("RFC 8785 Canonicalize failed: value cannot be serialized to JSON");
  }
  return result;
}

/**
 * Computes SHA-256 hex digest of a UTF-8 string or buffer.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Extracts the exact material fields defined in PRD §6.4 and produces
 * the canonical material structure.
 *
 * Excludes untrusted non-material fields (display names, images, descriptions).
 * Normalizes item sorting by sku.
 */
export function extractCanonicalPayload(
  proposal: ProposalPayloadInput
): CanonicalMaterialPayload {
  if (!proposal.workspace_id || typeof proposal.workspace_id !== "string") {
    throw new Error("workspace_id is required for proposal hash computation");
  }
  if (!Array.isArray(proposal.items) || proposal.items.length === 0) {
    throw new Error("proposal items must be a non-empty array");
  }

  assertIntegerCents(proposal.total_cents);
  const currency = validateCurrency(proposal.currency);
  const shippingCents = proposal.shipping_cents ?? 0;
  assertIntegerCents(shippingCents);
  const taxCents = proposal.tax_cents ?? 0;
  assertIntegerCents(taxCents);
  const termsVersion = proposal.checkout_terms_version ?? "1.0";

  // Filter items strictly to material fields only
  const materialItems: CanonicalMaterialItem[] = proposal.items.map((item, index) => {
    if (!item.sku || typeof item.sku !== "string") {
      throw new Error(`Item at index ${index} is missing a valid sku`);
    }
    if (!item.merchant_domain || typeof item.merchant_domain !== "string") {
      throw new Error(`Item at index ${index} is missing a valid merchant_domain`);
    }
    assertIntegerCents(item.unit_price_cents);
    if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Item at index ${index} has invalid quantity: ${item.quantity}`);
    }

    return {
      merchant_domain: item.merchant_domain.toLowerCase().trim(),
      quantity: item.quantity,
      sku: item.sku.trim(),
      unit_price_cents: item.unit_price_cents,
    };
  });

  // PRD §6.4: items sorted by sku
  materialItems.sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    checkout_terms_version: termsVersion,
    currency,
    items: materialItems,
    shipping_cents: shippingCents,
    tax_cents: taxCents,
    total_cents: proposal.total_cents,
    workspace_id: proposal.workspace_id.trim(),
  };
}

/**
 * Implements PRD §6.4:
 * proposal_hash = sha256(RFC 8785 canonical JSON of {
 *   workspace_id,
 *   items[{ sku, merchant_domain, unit_price_cents, quantity }] sorted by sku,
 *   currency,
 *   total_cents,
 *   shipping_cents,
 *   tax_cents,
 *   checkout_terms_version
 * })
 */
export function computeProposalHash(proposal: ProposalPayloadInput): string {
  const canonicalPayload = extractCanonicalPayload(proposal);
  const serialized = canonicalJson(canonicalPayload);
  return sha256(serialized);
}

/**
 * Returns the short 8-character hash representation shown in the UI.
 */
export function shortProposalHash(hash: string): string {
  return hash.slice(0, 8);
}
