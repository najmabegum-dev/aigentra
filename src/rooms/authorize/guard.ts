import { EvaluationResult } from "./types";

/**
 * Pure authorization execution guard.
 *
 * Golden Rule 1 & 2 (AGENTS.md):
 * A proposal can only reach execution if authorized under policy.
 * If the decision is DENY, execution is strictly forbidden under all circumstances.
 */
export function canExecute(
  evaluation: EvaluationResult,
  isHumanApproved = false
): boolean {
  if (!evaluation || evaluation.decision === "DENY") {
    return false;
  }
  if (evaluation.decision === "REQUIRE_APPROVAL") {
    return isHumanApproved;
  }
  return evaluation.decision === "ALLOW";
}
