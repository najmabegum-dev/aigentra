/**
 * Proposal State Machine (PRD §6.6)
 *
 * Implements pure state transitions. Any transition not explicitly listed
 * is rejected by code and logged as a security event.
 */

export type ProposalState =
  | "DRAFT"
  | "EVALUATED"
  | "APPROVED"
  | "REJECTED"
  | "DENIED"
  | "MANDATED"
  | "ORDER_CREATED"
  | "BUYER_APPROVED"
  | "BUYER_CANCELLED"
  | "CAPTURED"
  | "CAPTURE_FAILED"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "DRIFT_FLAGGED"
  | "EXPIRED"
  | "SUPERSEDED";

export type ProposalEvent =
  | "EVALUATE"
  | "EDIT"
  | "CHECKOUT_AUTO_GRANT"
  | "HUMAN_APPROVE"
  | "HUMAN_REJECT"
  | "EXPIRE"
  | "TERMINAL_DENY"
  | "ISSUE_MANDATE"
  | "CREATE_ORDER"
  | "BUYER_APPROVE"
  | "BUYER_CANCEL"
  | "CAPTURE_SUCCESS"
  | "CAPTURE_FAIL"
  | "CAPTURE_TIMEOUT"
  | "WEBHOOK_VERIFY"
  | "FLAG_DRIFT";

export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly fromState: ProposalState,
    public readonly event: ProposalEvent
  ) {
    super(
      `Illegal proposal state transition: cannot apply event "${event}" from state "${fromState}".`
    );
    this.name = "IllegalStateTransitionError";
  }
}

/**
 * Valid transitions lookup table directly reflecting PRD §6.6.
 */
const VALID_TRANSITIONS: Record<
  ProposalState,
  Partial<Record<ProposalEvent, ProposalState>>
> = {
  DRAFT: {
    EVALUATE: "EVALUATED",
    EDIT: "SUPERSEDED",
  },
  EVALUATED: {
    CHECKOUT_AUTO_GRANT: "MANDATED",
    HUMAN_APPROVE: "APPROVED",
    HUMAN_REJECT: "REJECTED",
    EXPIRE: "EXPIRED",
    TERMINAL_DENY: "DENIED",
  },
  APPROVED: {
    ISSUE_MANDATE: "MANDATED",
  },
  MANDATED: {
    CREATE_ORDER: "ORDER_CREATED",
    EXPIRE: "EXPIRED",
  },
  ORDER_CREATED: {
    BUYER_APPROVE: "BUYER_APPROVED",
    BUYER_CANCEL: "BUYER_CANCELLED",
    WEBHOOK_VERIFY: "CONFIRMED",
    FLAG_DRIFT: "DRIFT_FLAGGED",
  },
  BUYER_APPROVED: {
    CAPTURE_SUCCESS: "CAPTURED",
    CAPTURE_FAIL: "CAPTURE_FAILED",
    CAPTURE_TIMEOUT: "PENDING_CONFIRMATION",
    WEBHOOK_VERIFY: "CONFIRMED",
    FLAG_DRIFT: "DRIFT_FLAGGED",
  },
  CAPTURED: {
    WEBHOOK_VERIFY: "CONFIRMED",
    FLAG_DRIFT: "DRIFT_FLAGGED",
  },
  PENDING_CONFIRMATION: {
    WEBHOOK_VERIFY: "CONFIRMED",
    FLAG_DRIFT: "DRIFT_FLAGGED",
  },
  // Terminal states (no transitions allowed):
  REJECTED: {},
  DENIED: {},
  BUYER_CANCELLED: {},
  CAPTURE_FAILED: {
    HUMAN_APPROVE: "APPROVED",
    EVALUATE: "EVALUATED",
  },
  CONFIRMED: {},
  DRIFT_FLAGGED: {},
  EXPIRED: {},
  SUPERSEDED: {},
};

/**
 * Pure state machine transition function.
 * Returns next state or throws IllegalStateTransitionError.
 */
export function transition(
  state: ProposalState,
  event: ProposalEvent
): ProposalState {
  const allowed = VALID_TRANSITIONS[state];
  const next = allowed ? allowed[event] : undefined;

  if (!next) {
    throw new IllegalStateTransitionError(state, event);
  }

  return next;
}
