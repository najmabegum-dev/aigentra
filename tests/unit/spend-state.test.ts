import { describe, expect, it, beforeAll } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSpendState } from "@/rooms/authorize/spendState";
import { evaluate } from "@/rooms/authorize/engine";
import { issueMandate, verifyMandate } from "@/rooms/authorize/mandates";
import { executeCreateOrder } from "@/rooms/execute/executor";
import { PolicyRuleDefinition, ProposalToEvaluate } from "@/rooms/authorize/types";

describe("getSpendState & Cumulative Spend Tracking (F1)", () => {
  const wsId = "ws_test_spend_state";
  const policyVersionId = "pv_test_spend_state_v1";

  const baselinePolicy: PolicyRuleDefinition = {
    currency: "USD",
    per_item_max_cents: 15000,
    cart_max_cents: 20000,
    approval_threshold_cents: 5000,
    daily_cap_cents: 10000, // $100 daily limit
    merchant_mode: "ALLOWLIST_ONLY",
    merchants: ["store.google.com"],
    blocked_categories: [],
    velocity_minutes: 30,
    price_max_age_seconds: 300,
    valid_from: new Date(Date.now() - 3600000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: "ACTIVE",
    timezone: "Asia/Kolkata",
  };

  const sampleProposal: ProposalToEvaluate = {
    workspace_id: wsId,
    currency: "USD",
    total_cents: 3000, // $30
    items: [
      {
        sku: "TEST-SKU-1",
        merchant_domain: "store.google.com",
        unit_price_cents: 3000,
        server_price_cents: 3000,
        quantity: 1,
        category: "electronics",
        price_fetched_at: new Date().toISOString(),
      },
    ],
  };

  beforeAll(async () => {
    // Clean up
    await db.delete(schema.mandates).where(eq(schema.mandates.workspaceId, wsId));
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsId));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsId));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsId));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsId));

    // Seed workspace
    await db.insert(schema.workspaces).values({ id: wsId, killSwitch: false });
    await db.insert(schema.policies).values({ id: "pol_spend", workspaceId: wsId });
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_spend",
      workspaceId: wsId,
      version: 1,
      rulesJson: baselinePolicy,
    });
  });

  it("reads real kill_switch from workspace row and blocks evaluation with KILL_SWITCH_ON", async () => {
    // 1. Initially false
    let spend = await getSpendState(wsId, "Asia/Kolkata");
    expect(spend.kill_switch).toBe(false);

    let evalResult = evaluate(sampleProposal, baselinePolicy, spend, new Date());
    expect(evalResult.decision).not.toBe("DENY");
    expect(evalResult.reason_codes).not.toContain("KILL_SWITCH_ON");

    // 2. Turn kill switch on in workspace
    await db
      .update(schema.workspaces)
      .set({ killSwitch: true })
      .where(eq(schema.workspaces.id, wsId));

    spend = await getSpendState(wsId, "Asia/Kolkata");
    expect(spend.kill_switch).toBe(true);

    evalResult = evaluate(sampleProposal, baselinePolicy, spend, new Date());
    expect(evalResult.decision).toBe("DENY");
    expect(evalResult.reason_codes).toContain("KILL_SWITCH_ON");

    // Reset kill switch
    await db
      .update(schema.workspaces)
      .set({ killSwitch: false })
      .where(eq(schema.workspaces.id, wsId));
  });

  it("calculates daily_captured_cents from earlier CAPTURED proposals within the calendar day", async () => {
    const now = new Date();

    // Insert a captured proposal for $60 today
    await db.insert(schema.proposals).values({
      id: "prop_captured_today",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 6000,
      currency: "USD",
      proposalHash: "hash_captured_today",
      state: "CAPTURED",
      policyVersionId,
      createdAt: now,
      updatedAt: now,
    });

    // Insert an older captured proposal for $50 from 2 days ago (different calendar day)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
    await db.insert(schema.proposals).values({
      id: "prop_captured_old",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 5000,
      currency: "USD",
      proposalHash: "hash_captured_old",
      state: "CAPTURED",
      policyVersionId,
      createdAt: twoDaysAgo,
      updatedAt: twoDaysAgo,
    });

    const spend = await getSpendState(wsId, "Asia/Kolkata", now);
    // Should include $60 (6000 cents), but not $50 from 2 days ago
    expect(spend.daily_captured_cents).toBe(6000);

    // Baseline daily cap is $100 (10000 cents).
    // An existing $60 captured + new $30 sample cart = $90 <= $100 -> passes daily cap
    let evalResult = evaluate(sampleProposal, baselinePolicy, spend, now);
    expect(evalResult.reason_codes).not.toContain("DAILY_CAP_EXCEEDED");

    // A new cart of $45 (4500 cents) + $60 = $105 > $100 -> DAILY_CAP_EXCEEDED
    const largeCart: ProposalToEvaluate = {
      ...sampleProposal,
      total_cents: 4500,
      items: [
        {
          ...sampleProposal.items[0],
          unit_price_cents: 4500,
          server_price_cents: 4500,
        },
      ],
    };

    evalResult = evaluate(largeCart, baselinePolicy, spend, now);
    expect(evalResult.decision).toBe("DENY");
    expect(evalResult.reason_codes).toContain("DAILY_CAP_EXCEEDED");
  });

  it("calculates daily_reserved_cents for active states (MANDATED, ORDER_CREATED, BUYER_APPROVED) and excludes current proposal", async () => {
    const now = new Date();

    // Clean test proposals for this run
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsId));

    // 1. Insert a MANDATED proposal ($20)
    await db.insert(schema.proposals).values({
      id: "prop_mandated",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 2000,
      currency: "USD",
      proposalHash: "hash_mandated",
      state: "MANDATED",
      policyVersionId,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Insert an ORDER_CREATED proposal ($15)
    await db.insert(schema.proposals).values({
      id: "prop_order_created",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 1500,
      currency: "USD",
      proposalHash: "hash_order_created",
      state: "ORDER_CREATED",
      policyVersionId,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Insert a BUYER_APPROVED proposal ($25)
    await db.insert(schema.proposals).values({
      id: "prop_buyer_approved",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 2500,
      currency: "USD",
      proposalHash: "hash_buyer_approved",
      state: "BUYER_APPROVED",
      policyVersionId,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Insert an inactive proposal (PENDING_APPROVAL, $80) which should NOT count towards reserved spend
    await db.insert(schema.proposals).values({
      id: "prop_pending",
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 8000,
      currency: "USD",
      proposalHash: "hash_pending",
      state: "PENDING_APPROVAL",
      policyVersionId,
      createdAt: now,
      updatedAt: now,
    });

    // Reserved spend without exclusions = 2000 + 1500 + 2500 = 6000 cents
    let spend = await getSpendState(wsId, "Asia/Kolkata", now);
    expect(spend.daily_reserved_cents).toBe(6000);

    // Reserved spend excluding "prop_buyer_approved" (e.g. during its checkout/capture) = 6000 - 2500 = 3500 cents
    spend = await getSpendState(wsId, "Asia/Kolkata", now, "prop_buyer_approved");
    expect(spend.daily_reserved_cents).toBe(3500);

    // With $35 reserved, evaluating "prop_buyer_approved" ($25) gives $35 + $25 = $60 <= $100 daily cap -> ALLOW
    const evalResult = evaluate(
      { ...sampleProposal, total_cents: 2500 },
      baselinePolicy,
      spend,
      now
    );
    expect(evalResult.reason_codes).not.toContain("DAILY_CAP_EXCEEDED");
  });

  it("kill switch turned on after approval blocks checkout in executeCreateOrder", async () => {
    // 1. Create an approved proposal and issue a mandate
    const checkoutPropId = "prop_checkout_killswitch";
    const checkoutHash = "hash_checkout_killswitch_1234567890abcdef1234567890abcdef";

    await db.insert(schema.proposals).values({
      id: checkoutPropId,
      workspaceId: wsId,
      itemsJson: sampleProposal.items,
      totalCents: sampleProposal.total_cents,
      currency: "USD",
      proposalHash: checkoutHash,
      state: "APPROVED_HUMAN",
      policyVersionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId: checkoutPropId,
      proposalHash: checkoutHash,
      policyVersionId,
      amountCents: sampleProposal.total_cents,
      currency: "USD",
      merchantDomains: ["store.google.com"],
      grant: "HUMAN_APPROVAL",
    });

    const mandate = await verifyMandate({
      token: issued.token,
      expectedProposalHash: checkoutHash,
    });

    // 2. Turn kill switch ON in workspace after approval has occurred
    await db
      .update(schema.workspaces)
      .set({ killSwitch: true })
      .where(eq(schema.workspaces.id, wsId));

    // 3. Attempt to execute order creation
    await expect(
      executeCreateOrder({
        mandate,
        returnUrl: "http://localhost:3000/checkout?status=return",
        cancelUrl: "http://localhost:3000/checkout?status=cancel",
      })
    ).rejects.toThrow(/KILL_SWITCH_ON/);

    // Reset kill switch
    await db
      .update(schema.workspaces)
      .set({ killSwitch: false })
      .where(eq(schema.workspaces.id, wsId));
  });
});
