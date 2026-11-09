import { VerifiedMandate } from "@/rooms/authorize/types";
import { GatewayOrderResult, PaymentGateway } from "./types";
import { getPaymentGateway } from "./executor";
import { appendEvent } from "@/rooms/verify/ledger";

export interface VerifyReturnOrderParams {
  orderId: string;
  mandate: VerifiedMandate;
  gateway?: PaymentGateway;
}

export interface VerifyReturnOrderResult {
  valid: boolean;
  order?: GatewayOrderResult;
  reasonCode?: "ORDER_NOT_APPROVED" | "DRIFT_FLAGGED" | "ORDER_NOT_FOUND" | "VERIFICATION_ERROR";
  error?: string;
}

/**
 * Return Handler Verifier (PRD §8.2 step 4 & §8.3).
 *
 * Sequence:
 * 1. Server loads the order from PayPal via getOrder(orderId).
 * 2. Confirms status is APPROVED (or COMPLETED).
 * 3. Compares amount and custom_id with the mandate.
 * 4. Any difference triggers a DRIFT_FLAGGED security ledger event and halts execution.
 */
export async function verifyReturnOrder(
  params: VerifyReturnOrderParams
): Promise<VerifyReturnOrderResult> {
  const { orderId, mandate } = params;
  const gateway = params.gateway || getPaymentGateway();

  try {
    const order = await gateway.getOrder(orderId);

    // 1. Confirm order status
    if (order.status !== "APPROVED" && order.status !== "COMPLETED") {
      return {
        valid: false,
        order,
        reasonCode: "ORDER_NOT_APPROVED",
        error: `Order status is ${order.status}; buyer approval required before capture.`,
      };
    }

    // 2. Validate amount matching
    if (order.amountCents !== mandate.amountCents) {
      try {
        await appendEvent({
          workspaceId: mandate.workspaceId,
          entityType: "order",
          entityId: orderId,
          type: "SECURITY_POLICY_VIOLATION",
          actor: "verifier",
          payload: {
            violation: "AMOUNT_DRIFT",
            reasonCode: "DRIFT_FLAGGED",
            expectedAmountCents: mandate.amountCents,
            actualAmountCents: order.amountCents,
            proposalId: mandate.proposalId,
            proposalHash: mandate.proposalHash,
          },
        });
      } catch (err) {
        console.error("Failed to append ledger event for amount drift:", err);
      }

      return {
        valid: false,
        order,
        reasonCode: "DRIFT_FLAGGED",
        error: `Amount mismatch: mandate expects ${mandate.amountCents} cents, but PayPal order has ${order.amountCents} cents.`,
      };
    }

    // 3. Validate custom_id matching proposal_hash
    if (order.customId !== mandate.proposalHash) {
      try {
        await appendEvent({
          workspaceId: mandate.workspaceId,
          entityType: "order",
          entityId: orderId,
          type: "SECURITY_POLICY_VIOLATION",
          actor: "verifier",
          payload: {
            violation: "CUSTOM_ID_MISMATCH",
            reasonCode: "DRIFT_FLAGGED",
            expectedCustomId: mandate.proposalHash,
            actualCustomId: order.customId,
            proposalId: mandate.proposalId,
          },
        });
      } catch (err) {
        console.error("Failed to append ledger event for custom_id mismatch:", err);
      }

      return {
        valid: false,
        order,
        reasonCode: "DRIFT_FLAGGED",
        error: `custom_id mismatch: mandate proposalHash (${mandate.proposalHash}) does not match PayPal custom_id (${order.customId}).`,
      };
    }

    return {
      valid: true,
      order,
    };
  } catch (err: any) {
    return {
      valid: false,
      reasonCode: "VERIFICATION_ERROR",
      error: err.message || "Failed to load order from PayPal.",
    };
  }
}
