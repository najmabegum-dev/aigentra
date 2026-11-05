/**
 * Untrusted Product Content Sanitizer (PRD §9.2, Golden Rule 6).
 *
 * Product titles, descriptions and merchant text are untrusted data.
 * - Strips all URLs (http, https, www, ftp).
 * - Strips instruction-like markup (HTML/XML tags, [SYSTEM], [INST], control tokens).
 * - Enforces strict length capping.
 */

// Regex patterns for URLs
const URL_PATTERN = /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'{}|\\^`]+/gi;

// Regex patterns for instruction-like pseudo tags and LLM delimiters
const INSTRUCTION_TAG_PATTERN = /\[\/?(?:system|instruction|inst|assistant|user|override|admin|prompt)[^\]]*\]/gi;
const CHATML_BLOCK_PATTERN = /<\|im_start\|>[\s\S]*?<\|im_end\|>/gi;
const SPECIAL_TOKENS_PATTERN = /<\|[^>|]*\|>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const TEMPLATE_EXPR_PATTERN = /\$\{+[\s\S]*?\}+|\{\{[\s\S]*?\}\}/g;

/**
 * Strips URLs and instruction-like markup from raw text.
 */
export function stripMarkupAndUrls(text: string): string {
  if (!text) return "";

  return text
    // Strip URLs
    .replace(URL_PATTERN, "")
    // Strip ChatML blocks like <|im_start|>...<|im_end|>
    .replace(CHATML_BLOCK_PATTERN, "")
    // Strip standalone special LLM delimiters
    .replace(SPECIAL_TOKENS_PATTERN, "")
    // Strip pseudo instruction tags like [SYSTEM OVERRIDE]
    .replace(INSTRUCTION_TAG_PATTERN, "")
    // Strip HTML/XML tags
    .replace(HTML_TAG_PATTERN, "")
    // Strip template expressions like ${{...}} and {{...}}
    .replace(TEMPLATE_EXPR_PATTERN, "")
    // Normalize extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Enforces length cap with safe truncation.
 */
export function capLength(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  // Trim to maxLength
  const truncated = text.slice(0, maxLength).trim();
  return `${truncated}...`;
}

/**
 * Sanitizes a product title:
 * - Strips URLs and markup
 * - Caps length (default 120 characters)
 */
export function sanitizeTitle(raw: string | null | undefined, maxLength = 120): string {
  if (!raw) return "Untitled Product";
  const cleaned = stripMarkupAndUrls(raw);
  return capLength(cleaned || "Untitled Product", maxLength);
}

/**
 * Sanitizes a product description:
 * - Strips URLs and markup
 * - Caps length (default 300 characters)
 */
export function sanitizeDescription(raw: string | null | undefined, maxLength = 300): string {
  if (!raw) return "";
  const cleaned = stripMarkupAndUrls(raw);
  return capLength(cleaned, maxLength);
}

/**
 * Sanitizes merchant domain:
 * - Lowercase, trimmed, strip protocol and www
 */
export function sanitizeMerchantDomain(raw: string | null | undefined): string {
  if (!raw) return "unknown-merchant.com";
  let domain = raw.toLowerCase().trim();
  // Strip protocol if present
  domain = domain.replace(/^https?:\/\//, "");
  // Strip path or port if present
  domain = domain.split("/")[0].split(":")[0];
  // Strip leading www.
  domain = domain.replace(/^www\./, "");
  return domain || "unknown-merchant.com";
}
