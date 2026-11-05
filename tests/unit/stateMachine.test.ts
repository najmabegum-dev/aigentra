import { describe, it, expect } from "vitest";
import {
  transition,
  ProposalState,
  ProposalEvent,
  IllegalStateTransitionError,
} from "@/rooms/authorize/stateMachine";

describe("Proposal State Machine (PRD §6.6)", () => {
  describe("Legal Transitions", () => {
    it("transitions DRAFT -> EVALUATED on EVALUATE", () => {
      expect(transition("DRAFT", "EVALUATE")).toBe("EVALUATED");
    });

    it("transitions DRAFT -> SUPERSEDED on EDIT", () => {
      expect(transition("DRAFT", "EDIT")).toBe("SUPERSEDED");
    });

    it("transitions EVALUATED -> MANDATED on CHECKOUT_AUTO_GRANT", () => {
      expect(transition("EVALUATED", "CHECKOUT_AUTO_GRANT")).toBe("MANDATED");
    });

    it("transitions EVALUATED -> APPROVED on HUMAN_APPROVE", () => {
      expect(transition("EVALUATED", "HUMAN_APPROVE")).toBe("APPROVED");
    });

    it("transitions EVALUATED -> REJECTED on HUMAN_REJECT", () => {
      expect(transition("EVALUATED", "HUMAN_REJECT")).toBe("REJECTED");
    });

    it("transitions EVALUATED -> EXPIRED on EXPIRE", () => {
      expect(transition("EVALUATED", "EXPIRE")).toBe("EXPIRED");
    });

    it("transitions EVALUATED -> DENIED on TERMINAL_DENY", () => {
      expect(transition("EVALUATED", "TERMINAL_DENY")).toBe("DENIED");
    });

    it("transitions APPROVED -> MANDATED on ISSUE_MANDATE", () => {
      expect(transition("APPROVED", "ISSUE_MANDATE")).toBe("MANDATED");
    });

    it("transitions MANDATED -> ORDER_CREATED on CREATE_ORDER", () => {
      expect(transition("MANDATED", "CREATE_ORDER")).toBe("ORDER_CREATED");
    });

    it("transitions MANDATED -> EXPIRED on EXPIRE", () => {
      expect(transition("MANDATED", "EXPIRE")).toBe("EXPIRED");
    });

    it("transitions ORDER_CREATED -> BUYER_APPROVED on BUYER_APPROVE", () => {
      expect(transition("ORDER_CREATED", "BUYER_APPROVE")).toBe("BUYER_APPROVED");
    });

    it("transitions ORDER_CREATED -> BUYER_CANCELLED on BUYER_CANCEL", () => {
      expect(transition("ORDER_CREATED", "BUYER_CANCEL")).toBe("BUYER_CANCELLED");
    });

    it("transitions BUYER_APPROVED -> CAPTURED on CAPTURE_SUCCESS", () => {
      expect(transition("BUYER_APPROVED", "CAPTURE_SUCCESS")).toBe("CAPTURED");
    });

    it("transitions BUYER_APPROVED -> CAPTURE_FAILED on CAPTURE_FAIL", () => {
      expect(transition("BUYER_APPROVED", "CAPTURE_FAIL")).toBe("CAPTURE_FAILED");
    });

    it("transitions BUYER_APPROVED -> PENDING_CONFIRMATION on CAPTURE_TIMEOUT", () => {
      expect(transition("BUYER_APPROVED", "CAPTURE_TIMEOUT")).toBe("PENDING_CONFIRMATION");
    });

    it("transitions CAPTURED -> CONFIRMED on WEBHOOK_VERIFY", () => {
      expect(transition("CAPTURED", "WEBHOOK_VERIFY")).toBe("CONFIRMED");
    });

    it("transitions CAPTURED -> DRIFT_FLAGGED on FLAG_DRIFT", () => {
      expect(transition("CAPTURED", "FLAG_DRIFT")).toBe("DRIFT_FLAGGED");
    });
  });

  describe("Illegal Transitions", () => {
    it("rejects DRAFT -> CAPTURED bypass", () => {
      expect(() => transition("DRAFT", "CAPTURE_SUCCESS")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects jumping from DRAFT directly to ORDER_CREATED", () => {
      expect(() => transition("DRAFT", "CREATE_ORDER")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects reviving terminal DENIED state", () => {
      expect(() => transition("DENIED", "ISSUE_MANDATE")).toThrow(
        IllegalStateTransitionError
      );
      expect(() => transition("DENIED", "CHECKOUT_AUTO_GRANT")).toThrow(
        IllegalStateTransitionError
      );
      expect(() => transition("DENIED", "EVALUATE")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects transitions from terminal CONFIRMED state", () => {
      expect(() => transition("CONFIRMED", "EVALUATE")).toThrow(
        IllegalStateTransitionError
      );
      expect(() => transition("CONFIRMED", "EDIT")).toThrow(
        IllegalStateTransitionError
      );
      expect(() => transition("CONFIRMED", "CREATE_ORDER")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects transitions from SUPERSEDED state", () => {
      expect(() => transition("SUPERSEDED", "CREATE_ORDER")).toThrow(
        IllegalStateTransitionError
      );
      expect(() => transition("SUPERSEDED", "CHECKOUT_AUTO_GRANT")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects transitions from BUYER_CANCELLED state", () => {
      expect(() => transition("BUYER_CANCELLED", "CAPTURE_SUCCESS")).toThrow(
        IllegalStateTransitionError
      );
    });

    it("rejects capturing directly from MANDATED without BUYER_APPROVED", () => {
      expect(() => transition("MANDATED", "CAPTURE_SUCCESS")).toThrow(
        IllegalStateTransitionError
      );
    });
  });
});
