import { describe, it, expect } from "vitest";
import React from "react";
import AttackLabPage from "@/app/(workspace)/attack-lab/page";
import { ApprovalCentre } from "@/ui/approvals/ApprovalCentre";

describe("Attack Lab & Approval Centre UI Components", () => {
  it("AttackLabPage constructs as a React element", () => {
    const element = React.createElement(AttackLabPage);
    expect(element).toBeDefined();
    expect(typeof element.type).toBe("function");
  });

  it("ApprovalCentre constructs as a React element", () => {
    const element = React.createElement(ApprovalCentre);
    expect(element).toBeDefined();
    expect(typeof element.type).toBe("function");
  });
});
