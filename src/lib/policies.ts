import { z } from "zod";
import type { PolicyRuleDefinition, MerchantMode, PolicyStatus } from "@/rooms/authorize/types";
import { parseStringToCents, centsToPayPalString } from "./money";

export const SAMPLE_POLICY_NAME = "Home Office Guardrails";

export function normalizeDomain(domain: string): string {
  if (!domain || typeof domain !== "string") return "";
  let clean = domain.trim().toLowerCase();
  clean = clean.replace(/^[a-zA-Z]+:\/\//, ""); // strip protocol
  clean = clean.split("/")[0]; // strip path
  clean = clean.split("?")[0]; // strip query
  clean = clean.split("#")[0]; // strip hash
  clean = clean.split(":")[0]; // strip port
  if (clean.startsWith("www.")) {
    clean = clean.substring(4);
  }
  return clean.trim();
}

export function parseMerchantsInput(input: string | string[]): string[] {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map(normalizeDomain).filter(Boolean)));
  }
  if (typeof input === "string") {
    const rawList = input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(rawList.map(normalizeDomain).filter(Boolean)));
  }
  return [];
}

export const policyFormSchema = z
  .object({
    name: z.string().min(1, "Policy name is required").max(100, "Name too long"),
    currency: z.literal("USD").default("USD"),
    per_item_max: z.coerce.number().positive("Per-item limit must be greater than $0"),
    cart_max: z.coerce.number().positive("Cart maximum must be greater than $0"),
    approval_threshold: z.coerce.number().min(0, "Approval threshold cannot be negative"),
    daily_cap: z.coerce.number().positive("Daily cap must be greater than $0"),
    merchant_mode: z.enum(["ALLOWLIST_ONLY", "DENYLIST", "ANY_WITH_APPROVAL"]),
    merchants: z.union([z.string(), z.array(z.string())]).default(""),
    blocked_categories: z.array(z.string()).default([]),
    velocity_minutes: z.coerce.number().int().min(0).default(10),
    price_max_age_seconds: z.coerce.number().int().min(0).default(300),
    valid_from: z.string().default(() => new Date().toISOString()),
    expires_at: z.string().default(() => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "REVOKED"]).default("ACTIVE"),
    timezone: z.string().default("Asia/Kolkata"),
    kill_switch: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.per_item_max > data.cart_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["per_item_max"],
        message: "Per-item limit cannot exceed cart maximum",
      });
    }

    if (data.approval_threshold > data.cart_max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approval_threshold"],
        message: "Approval threshold cannot exceed cart maximum",
      });
    }

    if (data.cart_max > data.daily_cap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cart_max"],
        message: "Cart maximum cannot exceed daily spend cap",
      });
    }

    const fromTime = new Date(data.valid_from).getTime();
    const toTime = new Date(data.expires_at).getTime();
    if (!isNaN(fromTime) && !isNaN(toTime) && toTime <= fromTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: "Expiration date must be after valid-from date",
      });
    }
  })
  .transform((data): PolicyRuleDefinition => {
    const merchants = parseMerchantsInput(data.merchants);
    return {
      name: data.name,
      currency: "USD",
      per_item_max_cents: parseStringToCents(data.per_item_max.toFixed(2)),
      cart_max_cents: parseStringToCents(data.cart_max.toFixed(2)),
      approval_threshold_cents: parseStringToCents(data.approval_threshold.toFixed(2)),
      daily_cap_cents: parseStringToCents(data.daily_cap.toFixed(2)),
      merchant_mode: data.merchant_mode as MerchantMode,
      merchants,
      blocked_categories: data.blocked_categories,
      velocity_minutes: data.velocity_minutes,
      price_max_age_seconds: data.price_max_age_seconds,
      valid_from: data.valid_from,
      expires_at: data.expires_at,
      status: data.status as PolicyStatus,
      timezone: data.timezone,
      kill_switch: data.kill_switch,
    };
  });

export function generatePlainLanguageSummary(rules: PolicyRuleDefinition): string {
  const threshold = centsToPayPalString(rules.approval_threshold_cents);
  const cartMax = centsToPayPalString(rules.cart_max_cents);
  const perItem = centsToPayPalString(rules.per_item_max_cents);
  const dailyCap = centsToPayPalString(rules.daily_cap_cents);

  let merchantClause = "";
  if (rules.merchant_mode === "ALLOWLIST_ONLY") {
    merchantClause = `Only approved merchants are allowed: ${
      rules.merchants.length > 0 ? rules.merchants.join(", ") : "none currently configured"
    }.`;
  } else if (rules.merchant_mode === "DENYLIST") {
    merchantClause = `All merchants allowed except denylisted: ${
      rules.merchants.length > 0 ? rules.merchants.join(", ") : "none currently denylisted"
    }.`;
  } else {
    merchantClause = "Any unlisted merchant automatically requires human approval.";
  }

  const categoryClause =
    rules.blocked_categories.length > 0
      ? `Blocked categories: ${rules.blocked_categories.join(", ")}.`
      : "No categories currently blocked.";

  return (
    `Autonomous AI agent purchases are permitted up to $${threshold} USD. ` +
    `Purchases between $${threshold} and $${cartMax} USD require human approval. ` +
    `Any single item exceeding $${perItem} USD or total cart exceeding $${cartMax} USD is rejected immediately. ` +
    `Total spend is capped at $${dailyCap} USD per calendar day (${rules.timezone || "Asia/Kolkata"}). ` +
    `${merchantClause} ${categoryClause} Duplicate purchases within ${rules.velocity_minutes} minutes require human review.`
  );
}

export function createSamplePolicyRules(): PolicyRuleDefinition {
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    name: SAMPLE_POLICY_NAME,
    currency: "USD",
    cart_max_cents: 15000, // $150.00
    approval_threshold_cents: 5000, // $50.00
    per_item_max_cents: 12000, // $120.00
    daily_cap_cents: 20000, // $200.00
    merchant_mode: "DENYLIST",
    merchants: ["sketchy-deals.com", "gambling-gear.com"],
    blocked_categories: ["gift_cards", "gambling", "weapons"],
    velocity_minutes: 10,
    price_max_age_seconds: 300,
    valid_from: now.toISOString(),
    expires_at: oneYearLater.toISOString(),
    status: "ACTIVE",
    timezone: "Asia/Kolkata",
    kill_switch: false,
  };
}
