import { z } from "zod";

/**
 * Normalized Product representation across Channel3 and Seeded catalog.
 * Follows PRD §9.1 - §9.4 and AGENTS.md rules.
 *
 * Money is integer cents (never floats).
 * Text fields are sanitized and length-capped.
 */
export const productSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  merchant: z.string().min(1),
  merchant_domain: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD"),
  image_url: z.string().nullable().default(null),
  category: z.string().nullable().optional(),
  fetched_at: z.string(),
  fetchedAt: z.string(),
  source: z.enum(["channel3", "seeded"]),
});

export type Product = z.infer<typeof productSchema>;

export interface ProductSearchOptions {
  limit?: number;
  category?: string;
  maxPriceCents?: number;
}

export interface ProductSearchResult {
  products: Product[];
  source: "channel3" | "seeded";
  label: "Channel3" | "Seeded";
  query: string;
  total: number;
}
