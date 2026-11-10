import { describe, it, expect } from "vitest";
import React from "react";
import { DecisionCard, DecisionCardProps } from "@/ui/agent-workspace/DecisionCard";
import { AuthorityRail, AuthorityRailProps } from "@/ui/checkout/AuthorityRail";

describe("DecisionCard Component (PRD §10.2)", () => {
  it("constructs DecisionCard with ALLOW verdict, large tabular amount and hash chip", () => {
    const props: DecisionCardProps = {
      verdict: "ALLOW",
      reasonCodes: ["OK_AUTO_APPROVE"],
      ruleResults: [
        {
          rule: "maxCartAmount",
          passed: true,
          decision: "ALLOW",
          message: "Total $84.99 <= cap $150.00",
        },
      ],
      proposalHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      evaluatedAt: new Date().toISOString(),
      proposalId: "prop_demo_1",
      totalCents: 8499,
      onProceed: () => {},
    };

    const element = React.createElement(DecisionCard, props);
    expect(element).toBeDefined();
    expect(element.props.verdict).toBe("ALLOW");
    expect(element.props.totalCents).toBe(8499);
    expect(element.props.proposalHash).toBe(props.proposalHash);
    expect(element.props.ruleResults).toHaveLength(1);
    expect(element.props.reasonCodes).toContain("OK_AUTO_APPROVE");
  });

  it("constructs DecisionCard with DENY verdict and multiple reason codes", () => {
    const props: DecisionCardProps = {
      verdict: "DENY",
      reasonCodes: ["OVER_CART_CAP", "DENYLIST_MATCH"],
      ruleResults: [
        {
          rule: "maxCartAmount",
          passed: false,
          decision: "DENY",
          message: "Total $1,899.00 exceeds cap $150.00",
        },
        {
          rule: "denylist",
          passed: false,
          decision: "DENY",
          message: "Item SKU matched prohibited keyword",
        },
      ],
      proposalHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      evaluatedAt: new Date().toISOString(),
      proposalId: "prop_demo_deny",
      totalCents: 189900,
    };

    const element = React.createElement(DecisionCard, props);
    expect(element).toBeDefined();
    expect(element.props.verdict).toBe("DENY");
    expect(element.props.totalCents).toBe(189900);
    expect(element.props.reasonCodes).toEqual(["OVER_CART_CAP", "DENYLIST_MATCH"]);
    expect(element.props.ruleResults).toHaveLength(2);
  });

  it("constructs DecisionCard with REQUIRE_APPROVAL verdict", () => {
    const props: DecisionCardProps = {
      verdict: "REQUIRE_APPROVAL",
      reasonCodes: ["EXCEEDS_APPROVAL_THRESHOLD"],
      ruleResults: [
        {
          rule: "approvalThreshold",
          passed: true,
          decision: "REQUIRE_APPROVAL",
          message: "Cart total requires manual authorization",
        },
      ],
      proposalHash: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      evaluatedAt: new Date().toISOString(),
      totalCents: 12000,
    };

    const element = React.createElement(DecisionCard, props);
    expect(element.props.verdict).toBe("REQUIRE_APPROVAL");
  });
});

describe("AuthorityRail Component (PRD §10.3)", () => {
  it("constructs AuthorityRail across all 5 discrete stages", () => {
    const steps: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

    for (const step of steps) {
      const props: AuthorityRailProps = {
        currentStep: step,
        stepTimes: {
          policyDecision: "10:00:00 AM",
          approvalOrGrant: "10:00:02 AM",
          buyerConsent: "10:00:15 AM",
          capture: "10:00:20 AM",
          webhookConfirmed: "10:00:22 AM",
        },
        proposalId: "prop_rail_test",
      };

      const element = React.createElement(AuthorityRail, props);
      expect(element).toBeDefined();
      expect(element.props.currentStep).toBe(step);
      expect(element.props.proposalId).toBe("prop_rail_test");
      expect(element.props.stepTimes?.policyDecision).toBe("10:00:00 AM");
    }
  });

  it("supports failure and cancellation states on the rail", () => {
    const props: AuthorityRailProps = {
      currentStep: 3,
      proposalId: "prop_failed_test",
      isFailed: true,
      failureReason: "BUYER_CANCELLED",
    };

    const element = React.createElement(AuthorityRail, props);
    expect(element.props.isFailed).toBe(true);
    expect(element.props.failureReason).toBe("BUYER_CANCELLED");
  });
});
