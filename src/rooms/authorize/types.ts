/**
 * Types and Reason Codes for the Policy Engine (PRD §6.1 - §6.3)
 */

export type Decision = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";

export type AllowReasonCode = "WITHIN_ALL_LIMITS";

export type RequireApprovalReasonCode =
  | "OVER_APPROVAL_THRESHOLD"
  | "MERCHANT_NEEDS_APPROVAL"
  | "CATEGORY_UNKNOWN"
  | "VELOCITY_DUPLICATE_WINDOW";

export type DenyPolicyReasonCode =
  | "POLICY_MISSING"
  | "POLICY_PAUSED"
  | "POLICY_REVOKED"
  | "POLICY_EXPIRED"
  | "KILL_SWITCH_ON"
  | "MERCHANT_DENYLISTED"
  | "MERCHANT_NOT_ALLOWED"
  | "CATEGORY_BLOCKED"
  | "OVER_PER_ITEM_CAP"
  | "OVER_CART_CAP"
  | "DAILY_CAP_EXCEEDED";

export type DenyIntegrityReasonCode =
  | "INVALID_CURRENCY"
  | "INVALID_QUANTITY"
  | "UNKNOWN_PRODUCT"
  | "ITEM_PRICE_MISMATCH"
  | "TOTAL_MISMATCH"
  | "PRICE_STALE"
  | "EVAL_ERROR";

export type ExecutionReasonCode =
  | "MANDATE_MISSING"
  | "MANDATE_BAD_SIGNATURE"
  | "MANDATE_EXPIRED"
  | "MANDATE_ALREADY_USED"
  | "HASH_MISMATCH"
  | "POLICY_CHANGED"
  | "AMOUNT_DRIFT";

export type ReasonCode =
  | AllowReasonCode
  | RequireApprovalReasonCode
  | DenyPolicyReasonCode
  | DenyIntegrityReasonCode
  | ExecutionReasonCode;

export type MandateGrant = "POLICY_AUTO" | "HUMAN_APPROVAL";

declare const VerifiedMandateBrand: unique symbol;

export type VerifiedMandate = {
  readonly [VerifiedMandateBrand]: true;
  readonly jti: string;
  readonly workspaceId: string;
  readonly proposalId: string;
  readonly proposalHash: string;
  readonly policyVersionId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly merchantDomains: string[];
  readonly grant: MandateGrant;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly rawToken: string;
};

export interface MandateClaims {
  jti: string;
  sub: string;
  prop: string;
  polv: string;
  amt: number;
  cur: string;
  mrc: string[];
  grant: MandateGrant;
  proposal_id: string;
  iat: number;
  exp: number;
}

export type MerchantMode = "ALLOWLIST_ONLY" | "DENYLIST" | "ANY_WITH_APPROVAL";

export type PolicyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "REVOKED";

export interface PolicyRuleDefinition {
  name?: string;
  currency: "USD";
  per_item_max_cents: number;
  cart_max_cents: number;
  approval_threshold_cents: number;
  daily_cap_cents: number;
  merchant_mode: MerchantMode;
  merchants: string[];
  blocked_categories: string[];
  velocity_minutes: number;
  price_max_age_seconds: number;
  valid_from: string | Date;
  expires_at: string | Date;
  status: PolicyStatus;
  timezone?: string; // Default: "Asia/Kolkata"
  kill_switch?: boolean;
}

export interface ProposalItem {
  sku: string;
  merchant_domain: string;
  unit_price_cents: number;
  server_price_cents: number;
  quantity: number;
  category?: string | null;
  price_fetched_at: string | Date | number;
  name?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ProposalToEvaluate {
  workspace_id: string;
  items: ProposalItem[];
  currency: string;
  total_cents: number;
  shipping_cents?: number;
  tax_cents?: number;
  [key: string]: unknown;
}

export interface PastTransactionRecord {
  merchant_domain: string;
  sku: string;
  timestamp: string | Date | number;
  amount_cents?: number;
}

export interface SpendState {
  kill_switch?: boolean;
  daily_captured_cents: number;
  daily_reserved_cents: number;
  recent_transactions?: PastTransactionRecord[];
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  decision: Decision;
  reason_codes: ReasonCode[];
  message: string;
}

export interface EvaluationResult {
  decision: Decision;
  reason_codes: ReasonCode[];
  rule_results: RuleResult[];
}
