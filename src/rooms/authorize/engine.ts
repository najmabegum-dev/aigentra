import {
  Decision,
  EvaluationResult,
  PolicyRuleDefinition,
  ProposalToEvaluate,
  ReasonCode,
  RuleResult,
  SpendState,
} from "./types";

export * from "./types";

/**
 * Normalizes a merchant domain for consistent comparison.
 */
function normalizeDomain(domain: string | undefined): string {
  if (!domain) return "";
  return domain.toLowerCase().trim().replace(/^www\./, "");
}

/**
 * Pure policy evaluation engine.
 *
 * Golden Rule 3 (AGENTS.md):
 * The policy engine is a pure function (evaluate(proposal, policy, spendState, now)):
 * no network, no database, no clock reads inside.
 * Any exception returns DENY with EVAL_ERROR.
 *
 * PRD §6.2: Returns every rule's result (not just the first failure).
 * Outcome precedence: DENY beats REQUIRE_APPROVAL beats ALLOW.
 */
export function evaluate(
  proposal: ProposalToEvaluate,
  policy: PolicyRuleDefinition | null | undefined,
  spendState: SpendState,
  now: Date
): EvaluationResult {
  const ruleResults: RuleResult[] = [];
  const reasonCodesSet = new Set<ReasonCode>();

  try {
    // -------------------------------------------------------------------------
    // Rule 1: Schema & Data Integrity Checks
    // -------------------------------------------------------------------------

    // 1a. Currency check
    const isCurrencyValid = proposal?.currency === "USD";
    if (isCurrencyValid) {
      ruleResults.push({
        rule: "currency_integrity",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "Currency is valid USD.",
      });
    } else {
      ruleResults.push({
        rule: "currency_integrity",
        passed: false,
        decision: "DENY",
        reason_codes: ["INVALID_CURRENCY"],
        message: `Currency "${proposal?.currency}" is invalid. Sandbox requires USD.`,
      });
      reasonCodesSet.add("INVALID_CURRENCY");
    }

    // 1b. Quantity Bounds (1 to 10 per line)
    const items = Array.isArray(proposal?.items) ? proposal.items : [];
    let quantitiesValid = items.length > 0;
    for (const item of items) {
      if (
        typeof item.quantity !== "number" ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      ) {
        quantitiesValid = false;
        break;
      }
    }

    if (quantitiesValid) {
      ruleResults.push({
        rule: "quantity_bounds",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "All line item quantities are within bounds (1-10).",
      });
    } else {
      ruleResults.push({
        rule: "quantity_bounds",
        passed: false,
        decision: "DENY",
        reason_codes: ["INVALID_QUANTITY"],
        message: "Item quantity must be an integer between 1 and 10 per line.",
      });
      reasonCodesSet.add("INVALID_QUANTITY");
    }

    // 1c. Product SKU presence
    let skusValid = items.length > 0;
    for (const item of items) {
      if (!item.sku || typeof item.sku !== "string" || item.sku.trim().length === 0) {
        skusValid = false;
        break;
      }
    }

    if (skusValid) {
      ruleResults.push({
        rule: "sku_integrity",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "All items have valid SKUs.",
      });
    } else {
      ruleResults.push({
        rule: "sku_integrity",
        passed: false,
        decision: "DENY",
        reason_codes: ["UNKNOWN_PRODUCT"],
        message: "One or more items are missing a valid product SKU.",
      });
      reasonCodesSet.add("UNKNOWN_PRODUCT");
    }

    // 1d. Server-side price equality
    let pricesMatch = items.length > 0;
    for (const item of items) {
      if (
        typeof item.unit_price_cents !== "number" ||
        !Number.isSafeInteger(item.unit_price_cents) ||
        item.unit_price_cents < 0 ||
        item.unit_price_cents !== item.server_price_cents
      ) {
        pricesMatch = false;
        break;
      }
    }

    if (pricesMatch) {
      ruleResults.push({
        rule: "server_price_equality",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "All proposal unit prices match verified server-fetched prices.",
      });
    } else {
      ruleResults.push({
        rule: "server_price_equality",
        passed: false,
        decision: "DENY",
        reason_codes: ["ITEM_PRICE_MISMATCH"],
        message: "Item price does not match authoritative server price.",
      });
      reasonCodesSet.add("ITEM_PRICE_MISMATCH");
    }

    // 1e. Recomputed Total Equality
    let calculatedSum = 0;
    for (const item of items) {
      calculatedSum += (item.unit_price_cents || 0) * (item.quantity || 0);
    }
    const shipping = proposal?.shipping_cents ?? 0;
    const tax = proposal?.tax_cents ?? 0;
    const expectedTotal = calculatedSum + shipping + tax;
    const isTotalValid =
      typeof proposal?.total_cents === "number" &&
      proposal.total_cents === expectedTotal;

    if (isTotalValid) {
      ruleResults.push({
        rule: "total_equality",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "Proposal total matches recomputed items, shipping, and tax.",
      });
    } else {
      ruleResults.push({
        rule: "total_equality",
        passed: false,
        decision: "DENY",
        reason_codes: ["TOTAL_MISMATCH"],
        message: `Proposal total (${proposal?.total_cents}) does not match server-recomputed total (${expectedTotal}).`,
      });
      reasonCodesSet.add("TOTAL_MISMATCH");
    }

    // 1f. Price freshness
    let pricesFresh = items.length > 0;
    const maxAgeSec = policy?.price_max_age_seconds ?? 300;
    const nowTime = now.getTime();

    for (const item of items) {
      const fetchedTime = new Date(item.price_fetched_at).getTime();
      if (isNaN(fetchedTime) || (nowTime - fetchedTime) / 1000 > maxAgeSec) {
        pricesFresh = false;
        break;
      }
    }

    if (pricesFresh) {
      ruleResults.push({
        rule: "price_freshness",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "All item prices are fresh.",
      });
    } else {
      ruleResults.push({
        rule: "price_freshness",
        passed: false,
        decision: "DENY",
        reason_codes: ["PRICE_STALE"],
        message: "One or more item prices are stale and must be refreshed.",
      });
      reasonCodesSet.add("PRICE_STALE");
    }

    // -------------------------------------------------------------------------
    // Rule 2: Kill Switch & Policy Lifecycle Status
    // -------------------------------------------------------------------------

    // 2a. Kill Switch
    const killSwitchTriggered = Boolean(spendState?.kill_switch || policy?.kill_switch);
    if (!killSwitchTriggered) {
      ruleResults.push({
        rule: "kill_switch",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "Kill switch is inactive.",
      });
    } else {
      ruleResults.push({
        rule: "kill_switch",
        passed: false,
        decision: "DENY",
        reason_codes: ["KILL_SWITCH_ON"],
        message: "Kill switch is ON. All operations are paused.",
      });
      reasonCodesSet.add("KILL_SWITCH_ON");
    }

    // 2b. Policy existence and status
    if (!policy || policy.status === "DRAFT") {
      ruleResults.push({
        rule: "policy_existence",
        passed: false,
        decision: "DENY",
        reason_codes: ["POLICY_MISSING"],
        message: "Active policy is missing or in unconfirmed draft state.",
      });
      reasonCodesSet.add("POLICY_MISSING");
    } else if (policy.status === "PAUSED") {
      ruleResults.push({
        rule: "policy_existence",
        passed: false,
        decision: "DENY",
        reason_codes: ["POLICY_PAUSED"],
        message: "Policy is currently paused.",
      });
      reasonCodesSet.add("POLICY_PAUSED");
    } else if (policy.status === "REVOKED") {
      ruleResults.push({
        rule: "policy_existence",
        passed: false,
        decision: "DENY",
        reason_codes: ["POLICY_REVOKED"],
        message: "Policy has been revoked.",
      });
      reasonCodesSet.add("POLICY_REVOKED");
    } else {
      ruleResults.push({
        rule: "policy_existence",
        passed: true,
        decision: "ALLOW",
        reason_codes: ["WITHIN_ALL_LIMITS"],
        message: "Policy exists and is in active status.",
      });
    }

    // 2c. Validity Window
    if (policy && policy.valid_from && policy.expires_at) {
      const validFromTime = new Date(policy.valid_from).getTime();
      const expiresAtTime = new Date(policy.expires_at).getTime();

      if (nowTime < validFromTime || nowTime > expiresAtTime) {
        ruleResults.push({
          rule: "policy_validity_window",
          passed: false,
          decision: "DENY",
          reason_codes: ["POLICY_EXPIRED"],
          message: "Current time is outside policy validity window.",
        });
        reasonCodesSet.add("POLICY_EXPIRED");
      } else {
        ruleResults.push({
          rule: "policy_validity_window",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: "Policy is within its validity window.",
        });
      }
    }

    // -------------------------------------------------------------------------
    // Rule 3: Merchant Controls (Allowlist / Denylist / Any with Approval)
    // -------------------------------------------------------------------------
    if (policy) {
      const policyMerchants = (policy.merchants || []).map(normalizeDomain);
      const merchantMode = policy.merchant_mode || "ALLOWLIST_ONLY";

      let merchantPassed = true;
      let merchantDecision: Decision = "ALLOW";
      let merchantReason: ReasonCode = "WITHIN_ALL_LIMITS";
      let merchantMsg = "Merchant checks passed.";

      for (const item of items) {
        const itemDomain = normalizeDomain(item.merchant_domain);

        if (merchantMode === "ALLOWLIST_ONLY") {
          const isAllowed = policyMerchants.some(
            (m) => itemDomain === m || itemDomain.endsWith("." + m)
          );
          if (!isAllowed) {
            merchantPassed = false;
            merchantDecision = "DENY";
            merchantReason = "MERCHANT_NOT_ALLOWED";
            merchantMsg = `Merchant "${item.merchant_domain}" is not in allowlist.`;
            break;
          }
        } else if (merchantMode === "DENYLIST") {
          const isDenylisted = policyMerchants.some(
            (m) => itemDomain === m || itemDomain.endsWith("." + m)
          );
          if (isDenylisted) {
            merchantPassed = false;
            merchantDecision = "DENY";
            merchantReason = "MERCHANT_DENYLISTED";
            merchantMsg = `Merchant "${item.merchant_domain}" is denylisted.`;
            break;
          }
        } else if (merchantMode === "ANY_WITH_APPROVAL") {
          const isKnown = policyMerchants.some(
            (m) => itemDomain === m || itemDomain.endsWith("." + m)
          );
          if (!isKnown) {
            merchantPassed = false;
            merchantDecision = "REQUIRE_APPROVAL";
            merchantReason = "MERCHANT_NEEDS_APPROVAL";
            merchantMsg = `Merchant "${item.merchant_domain}" is new and requires human approval.`;
          }
        }
      }

      ruleResults.push({
        rule: "merchant_control",
        passed: merchantPassed,
        decision: merchantDecision,
        reason_codes: merchantPassed ? ["WITHIN_ALL_LIMITS"] : [merchantReason],
        message: merchantMsg,
      });

      if (!merchantPassed) {
        reasonCodesSet.add(merchantReason);
      }
    }

    // -------------------------------------------------------------------------
    // Rule 4: Categories (Blocked & Unknown)
    // -------------------------------------------------------------------------
    if (policy) {
      const blockedCategories = new Set(
        (policy.blocked_categories || []).map((c) => c.toLowerCase().trim())
      );
      let categoryPassed = true;
      let categoryDecision: Decision = "ALLOW";
      let categoryReason: ReasonCode = "WITHIN_ALL_LIMITS";
      let categoryMsg = "All item categories are permitted.";

      for (const item of items) {
        const cat = item.category ? item.category.toLowerCase().trim() : "";

        if (!cat) {
          categoryPassed = false;
          categoryDecision = "REQUIRE_APPROVAL";
          categoryReason = "CATEGORY_UNKNOWN";
          categoryMsg = `Item "${item.sku}" has an unknown or missing category.`;
        } else if (blockedCategories.has(cat)) {
          categoryPassed = false;
          categoryDecision = "DENY";
          categoryReason = "CATEGORY_BLOCKED";
          categoryMsg = `Category "${cat}" is blocked by policy.`;
          break;
        }
      }

      ruleResults.push({
        rule: "category_control",
        passed: categoryPassed,
        decision: categoryDecision,
        reason_codes: categoryPassed ? ["WITHIN_ALL_LIMITS"] : [categoryReason],
        message: categoryMsg,
      });

      if (!categoryPassed) {
        reasonCodesSet.add(categoryReason);
      }
    }

    // -------------------------------------------------------------------------
    // Rule 5: Caps (Per-Item Cap & Cart Cap)
    // -------------------------------------------------------------------------
    if (policy) {
      // 5a. Per-item max cap
      let itemCapPassed = true;
      for (const item of items) {
        if (item.unit_price_cents > policy.per_item_max_cents) {
          itemCapPassed = false;
          break;
        }
      }

      if (itemCapPassed) {
        ruleResults.push({
          rule: "per_item_cap",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: `All items are within the per-item cap of ${policy.per_item_max_cents} cents.`,
        });
      } else {
        ruleResults.push({
          rule: "per_item_cap",
          passed: false,
          decision: "DENY",
          reason_codes: ["OVER_PER_ITEM_CAP"],
          message: `An item exceeds the per-item limit of ${policy.per_item_max_cents} cents.`,
        });
        reasonCodesSet.add("OVER_PER_ITEM_CAP");
      }

      // 5b. Cart max cap
      if (proposal.total_cents <= policy.cart_max_cents) {
        ruleResults.push({
          rule: "cart_max_cap",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: `Cart total is within maximum cap of ${policy.cart_max_cents} cents.`,
        });
      } else {
        ruleResults.push({
          rule: "cart_max_cap",
          passed: false,
          decision: "DENY",
          reason_codes: ["OVER_CART_CAP"],
          message: `Cart total (${proposal.total_cents}) exceeds ceiling of ${policy.cart_max_cents} cents.`,
        });
        reasonCodesSet.add("OVER_CART_CAP");
      }
    }

    // -------------------------------------------------------------------------
    // Rule 6: Daily Cap (Captured + Reserved + This Cart)
    // -------------------------------------------------------------------------
    if (policy) {
      const dailyCap = policy.daily_cap_cents;
      const captured = spendState?.daily_captured_cents || 0;
      const reserved = spendState?.daily_reserved_cents || 0;
      const totalDailySpend = captured + reserved + (proposal?.total_cents || 0);

      if (totalDailySpend <= dailyCap) {
        ruleResults.push({
          rule: "daily_cap",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: `Total daily spend (${totalDailySpend}) is within daily cap (${dailyCap}).`,
        });
      } else {
        ruleResults.push({
          rule: "daily_cap",
          passed: false,
          decision: "DENY",
          reason_codes: ["DAILY_CAP_EXCEEDED"],
          message: `Cumulative daily spend (${totalDailySpend}) exceeds daily cap (${dailyCap}).`,
        });
        reasonCodesSet.add("DAILY_CAP_EXCEEDED");
      }
    }

    // -------------------------------------------------------------------------
    // Rule 7: Velocity Duplicate Window
    // -------------------------------------------------------------------------
    if (policy) {
      const velocityMin = policy.velocity_minutes || 0;
      const velocityMs = velocityMin * 60 * 1000;
      const recentTx = spendState?.recent_transactions || [];

      let velocityConflict = false;
      for (const item of items) {
        const itemDomain = normalizeDomain(item.merchant_domain);
        for (const tx of recentTx) {
          const txDomain = normalizeDomain(tx.merchant_domain);
          if (txDomain === itemDomain && tx.sku === item.sku) {
            const txTime = new Date(tx.timestamp).getTime();
            if (nowTime - txTime <= velocityMs) {
              velocityConflict = true;
              break;
            }
          }
        }
        if (velocityConflict) break;
      }

      if (!velocityConflict) {
        ruleResults.push({
          rule: "velocity_window",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: "No rapid duplicate orders detected.",
        });
      } else {
        ruleResults.push({
          rule: "velocity_window",
          passed: false,
          decision: "REQUIRE_APPROVAL",
          reason_codes: ["VELOCITY_DUPLICATE_WINDOW"],
          message: `Identical item was purchased from the same merchant within the ${velocityMin} minute velocity window.`,
        });
        reasonCodesSet.add("VELOCITY_DUPLICATE_WINDOW");
      }
    }

    // -------------------------------------------------------------------------
    // Rule 8: Approval Threshold
    // -------------------------------------------------------------------------
    if (policy) {
      if (proposal.total_cents > policy.approval_threshold_cents) {
        ruleResults.push({
          rule: "approval_threshold",
          passed: false,
          decision: "REQUIRE_APPROVAL",
          reason_codes: ["OVER_APPROVAL_THRESHOLD"],
          message: `Cart total (${proposal.total_cents}) exceeds auto-approval threshold (${policy.approval_threshold_cents}).`,
        });
        reasonCodesSet.add("OVER_APPROVAL_THRESHOLD");
      } else {
        ruleResults.push({
          rule: "approval_threshold",
          passed: true,
          decision: "ALLOW",
          reason_codes: ["WITHIN_ALL_LIMITS"],
          message: `Cart total is within auto-approval threshold.`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Resolution: Precedence (DENY beats REQUIRE_APPROVAL beats ALLOW)
    // -------------------------------------------------------------------------
    let finalDecision: Decision = "ALLOW";

    const hasDeny = ruleResults.some((r) => r.decision === "DENY");
    const hasRequireApproval = ruleResults.some((r) => r.decision === "REQUIRE_APPROVAL");

    if (hasDeny) {
      finalDecision = "DENY";
    } else if (hasRequireApproval) {
      finalDecision = "REQUIRE_APPROVAL";
    } else {
      finalDecision = "ALLOW";
      reasonCodesSet.add("WITHIN_ALL_LIMITS");
    }

    if (finalDecision !== "ALLOW") {
      reasonCodesSet.delete("WITHIN_ALL_LIMITS");
    }

    return {
      decision: finalDecision,
      reason_codes: Array.from(reasonCodesSet),
      rule_results: ruleResults,
    };
  } catch (error) {
    // Fail Closed: PRD §6.2 step 9: Any thrown error anywhere -> DENY with EVAL_ERROR
    return {
      decision: "DENY",
      reason_codes: ["EVAL_ERROR"],
      rule_results: [
        ...ruleResults,
        {
          rule: "system_eval_safety",
          passed: false,
          decision: "DENY",
          reason_codes: ["EVAL_ERROR"],
          message:
            error instanceof Error
              ? `Internal policy evaluation error: ${error.message}`
              : "Unknown policy evaluation failure.",
        },
      ],
    };
  }
}
