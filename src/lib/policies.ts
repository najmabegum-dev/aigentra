import type { PolicyRuleDefinition } from "@/rooms/authorize/types";

export const SAMPLE_POLICY_NAME = "Home Office Guardrails";

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
  };
}
