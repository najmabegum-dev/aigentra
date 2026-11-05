import { Product, ProductSearchOptions, ProductSearchResult } from "./types";
import { searchSeededCatalog } from "./seeded";
import { sanitizeDescription, sanitizeMerchantDomain, sanitizeTitle } from "./sanitize";

const CHANNEL3_SEARCH_URL = "https://api.trychannel3.com/v1/search";
const DEFAULT_TIMEOUT_MS = 5000;

interface Channel3Offer {
  domain?: string;
  website_id?: string;
  url?: string;
  availability?: string;
  price?: {
    price?: number | string;
    currency?: string;
    compare_at_price?: number | string;
  };
}

interface Channel3Image {
  url?: string;
  cleaned_url?: string;
  thumbnail_url?: string;
}

interface Channel3Category {
  title?: string;
  slug?: string;
}

interface Channel3ProductRaw {
  id: string;
  title: string;
  description?: string | null;
  brands?: Array<{ id?: string; name?: string }>;
  images?: Channel3Image[];
  category?: Channel3Category | null;
  offers?: Channel3Offer[];
}

interface Channel3SearchResponse {
  products?: Channel3ProductRaw[];
  next_page_token?: string | null;
}

/**
 * Converts a float or string price to exact integer cents (AGENTS.md Rule 4).
 */
export function toCents(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) {
    return Math.round(val * 100);
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return Math.round(parsed * 100);
    }
  }
  return 0;
}

/**
 * Maps a raw Channel3 API product object into AIGENTRA's strict Product type.
 */
export function mapChannel3Product(raw: Channel3ProductRaw, now = new Date()): Product {
  const primaryOffer = raw.offers?.[0];
  const primaryImage = raw.images?.[0];

  const rawMerchant =
    primaryOffer?.domain ||
    primaryOffer?.website_id ||
    raw.brands?.[0]?.name ||
    "retailer.com";

  const rawPrice = primaryOffer?.price?.price ?? 0;
  const rawCurrency = (primaryOffer?.price?.currency || "USD").toUpperCase();

  const imageUrl =
    primaryImage?.cleaned_url ||
    primaryImage?.url ||
    primaryImage?.thumbnail_url ||
    null;

  const category = raw.category?.title || raw.category?.slug || null;
  const isoNow = now.toISOString();

  const sanitizedTitle = sanitizeTitle(raw.title);
  const sanitizedDesc = sanitizeDescription(raw.description);
  const sanitizedDomain = sanitizeMerchantDomain(rawMerchant);

  return {
    sku: `c3_${raw.id}`,
    title: sanitizedTitle,
    description: sanitizedDesc,
    merchant: sanitizedDomain,
    merchant_domain: sanitizedDomain,
    price_cents: toCents(rawPrice),
    currency: rawCurrency,
    image_url: imageUrl,
    category,
    fetched_at: isoNow,
    fetchedAt: isoNow,
    source: "channel3",
  };
}

/**
 * Performs a product search:
 * 1. Queries Channel3 live API if CHANNEL3_API_KEY is configured.
 * 2. On missing key, network failure, timeout, or empty responses, falls back to the seeded catalogue.
 * 3. Results are explicitly labelled with their source ("Channel3" or "Seeded") per PRD F3 & §9.3.
 */
export async function searchProducts(
  query: string,
  options?: ProductSearchOptions,
  now = new Date()
): Promise<ProductSearchResult> {
  const apiKey = process.env.CHANNEL3_API_KEY?.trim();

  // If CHANNEL3_API_KEY is not configured, immediately use Seeded catalog
  if (!apiKey || apiKey === "mock_channel3_key" || apiKey === "placeholder") {
    const seeded = searchSeededCatalog(query, options, now);
    return {
      products: seeded,
      source: "seeded",
      label: "Seeded",
      query,
      total: seeded.length,
    };
  }

  const limit = options?.limit ?? 10;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(CHANNEL3_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: query.trim(),
        limit,
        filters: {
          availability: ["InStock"],
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `Channel3 search returned non-OK status ${response.status}. Falling back to Seeded catalogue.`
      );
      const seeded = searchSeededCatalog(query, options, now);
      return {
        products: seeded,
        source: "seeded",
        label: "Seeded",
        query,
        total: seeded.length,
      };
    }

    const data = (await response.json()) as Channel3SearchResponse;
    const rawProducts = data.products || [];

    if (rawProducts.length === 0) {
      // If live search returned 0 items, fallback to seeded to keep demo responsive
      const seeded = searchSeededCatalog(query, options, now);
      return {
        products: seeded,
        source: "seeded",
        label: "Seeded",
        query,
        total: seeded.length,
      };
    }

    const mapped = rawProducts.map((p) => mapChannel3Product(p, now));

    return {
      products: mapped,
      source: "channel3",
      label: "Channel3",
      query,
      total: mapped.length,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(
      "Channel3 search request failed. Gracefully falling back to Seeded catalogue:",
      error instanceof Error ? error.message : "Unknown error"
    );

    const seeded = searchSeededCatalog(query, options, now);
    return {
      products: seeded,
      source: "seeded",
      label: "Seeded",
      query,
      total: seeded.length,
    };
  }
}
