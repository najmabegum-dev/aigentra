import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { appendEvent } from "@/rooms/verify/ledger";

export interface CancelProposalParams {
  proposalId: string;
  workspaceId: string;
  reason?: string;
}

export interface CancelProposalResult {
  success: boolean;
  state?: string;
  error?: string;
}

/**
 * Cancels a proposal when the buyer cancels during checkout (PRD §8.3 Row 2).
 *
 * Requirements:
 * 1. Transitions proposal state to BUYER_CANCELLED.
 * 2. Releases reservation (budget tracking).
 * 3. Appends a hash-chained ledger event.
 * 4. Mandate cannot be reused; a new approval is required to retry.
 */
export async function cancelCheckoutProposal(
  params: CancelProposalParams
): Promise<CancelProposalResult> {
  const { proposalId, workspaceId, reason } = params;
  const db = await getDb();

  const proposals = await db
    .select()
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.id, proposalId),
        eq(schema.proposals.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (proposals.length === 0) {
    return {
      success: false,
      error: `Proposal not found: ${proposalId}`,
    };
  }

  const proposal = proposals[0];

  // If already captured or confirmed, cancellation is not allowed
  if (proposal.state === "CAPTURED" || proposal.state === "CONFIRMED") {
    return {
      success: false,
      error: `Cannot cancel proposal in state ${proposal.state}.`,
    };
  }

  // Update proposal state to BUYER_CANCELLED
  await db
    .update(schema.proposals)
    .set({
      state: "BUYER_CANCELLED",
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, proposal.id));

  // Append hash-chained ledger event (Golden Rule 8)
  await appendEvent({
    workspaceId,
    entityType: "proposal",
    entityId: proposal.id,
    type: "BUYER_CANCELLED",
    actor: "buyer",
    payload: {
      proposal_id: proposal.id,
      status: "BUYER_CANCELLED",
      reason: reason || "Buyer cancelled authorization on PayPal checkout",
      amount_cents: proposal.totalCents,
      currency: proposal.currency || "USD",
    },
  });

  return {
    success: true,
    state: "BUYER_CANCELLED",
  };
}
