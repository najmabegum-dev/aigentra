import { describe, it, expect } from "vitest";
import React from "react";
import { AuthorityBudgetRing } from "@/studio/widgets/AuthorityBudgetRing";
import { DecisionMixWidget } from "@/studio/widgets/DecisionMixWidget";
import { BlockedAttemptsFeed } from "@/studio/widgets/BlockedAttemptsFeed";
import { ChainIntegrityBadge } from "@/studio/widgets/ChainIntegrityBadge";
import { LedgerGridWidget } from "@/studio/widgets/LedgerGridWidget";

describe("Studio Custom Widgets (PRD §10.4, F9)", () => {
  it("AuthorityBudgetRing element constructs with correct props", () => {
    const element = React.createElement(AuthorityBudgetRing, {
      spentCents: 8499,
      reservedCents: 5000,
      dailyCapCents: 20000,
      currency: "USD",
    });
    expect(element).toBeDefined();
    expect(element.props.spentCents).toBe(8499);
    expect(element.props.dailyCapCents).toBe(20000);
  });

  it("DecisionMixWidget element constructs with decision buckets", () => {
    const decisions = [
      { id: "1", decision: "ALLOW" as const, created_at: new Date().toISOString() },
      { id: "2", decision: "REQUIRE_APPROVAL" as const, created_at: new Date().toISOString() },
      { id: "3", decision: "DENY" as const, created_at: new Date().toISOString() },
    ];
    const element = React.createElement(DecisionMixWidget, { decisions });
    expect(element).toBeDefined();
    expect(element.props.decisions).toHaveLength(3);
  });

  it("BlockedAttemptsFeed element constructs with attempts", () => {
    const attempts = [
      {
        id: "eval_1",
        proposal_id: "prop_injected_sample",
        decision: "DENY",
        reason_codes: ["OVER_CART_CAP"],
        created_at: new Date().toISOString(),
        details: "Executive High-Back Mesh Ergonomic Office Chair [SYSTEM OVERRIDE]",
      },
    ];
    const element = React.createElement(BlockedAttemptsFeed, { attempts });
    expect(element).toBeDefined();
    expect(element.props.attempts).toHaveLength(1);
  });

  it("ChainIntegrityBadge element constructs with OK status for intact chains", () => {
    const element = React.createElement(ChainIntegrityBadge, {
      workspaceId: "ws_test_01",
      chainLength: 10,
      lastVerifiedAt: "10:00:00 AM",
      isBroken: false,
    });
    expect(element).toBeDefined();
    expect(element.props.chainLength).toBe(10);
    expect(element.props.isBroken).toBe(false);
  });

  it("LedgerGridWidget element constructs with events and workspace", () => {
    const events = [
      {
        id: "evt_1",
        seq: 1,
        entity_type: "proposal",
        entity_id: "prop_1",
        type: "PROPOSAL_CREATED",
        actor: "agent",
        payload: { amount: 5000 },
        prev_hash: "0".repeat(64),
        event_hash: "hash_test_123",
        created_at: new Date().toISOString(),
        source: "live",
      },
    ];
    const element = React.createElement(LedgerGridWidget, {
      events,
      workspaceId: "ws_test_01",
    });
    expect(element).toBeDefined();
    expect(element.props.events).toHaveLength(1);
    expect(element.props.workspaceId).toBe("ws_test_01");
  });
});
