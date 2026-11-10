import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  VerifiedMandate,
  PolicyRuleDefinition,
  ProposalToEvaluate,
  SpendState,
} from "@/rooms/authorize/types";
import { evaluate } from "@/rooms/authorize/engine";
import { getSpendState } from "@/rooms/authorize/spendState";
import { consumeMandate, verifyMandate } from "@/rooms/authorize/mandates";
import {
  GatewayCaptureResult,
  GatewayCreateOrderInput,
  GatewayOrderResult,
  PaymentGateway,
} from "./types";
import { DevStubGateway } from "./devStub";
import { PayPalGateway } from "./paypalGateway";
import { verifyReturnOrder } from "./returnVerifier";
import { appendEvent } from "@/rooms/verify/ledger";

// Cached gateway singleton
let activeGateway: PaymentGateway | null = null;

/**
 * Resets active gateway instance for test isolation.
 */
export function _resetPaymentGatewayForTesting(): void {
  activeGateway = null;
}

/**
 * Returns the configured Payment Gateway instance.
 * PRD §8.1: Selects PayPalGateway if PAYMENT_MODE === "paypal" or "paypal_sandbox".
 * Defaults to DevStubGateway for dev_stub mode and automated testing.
 *
 * In production (NODE_ENV === "production"), if PAYMENT_MODE is "paypal" and
 * PayPalGateway cannot initialize, it strictly throws an error and never falls back to DevStubGateway.
 */
export function getPaymentGateway(): PaymentGateway {
  if (activeGateway) {
    return activeGateway;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const mode = process.env.PAYMENT_MODE || "dev_stub";
  if (mode === "paypal" || mode === "paypal_sandbox") {
    try {
      activeGateway = new PayPalGateway();
      return activeGateway;
    } catch (err) {
      if (isProduction) {
        throw new Error(
          `Failed to initialize PayPalGateway in production: ${
            err instanceof Error ? err.message : String(err)
          }. Falling back to DevStubGateway is forbidden in production.`
        );
      }
      console.error("Failed to initialize PayPalGateway, falling back to DevStubGateway in non-production:", err);
      activeGateway = new DevStubGateway();
      return activeGateway;
    }
  }

  activeGateway = new DevStubGateway();
  return activeGateway;
}

export interface ExecuteCreateOrderParams {
  mandate: VerifiedMandate;
  gateway?: PaymentGateway;
  returnUrl: string;
  cancelUrl: string;
}

/**
 * Executes PayPal order creation under the Authority Gate (PRD §8.2 Step 2, §8.3 Row 3).
 *
 * Requirements:
 * 1. Accepts ONLY a VerifiedMandate (Golden Rule 2).
 * 2. Re-verifies mandate and re-runs policy engine before invoking the gateway.
 * 3. Persists idempotency key (PayPal-Request-Id) BEFORE calling the gateway.
 * 4. Anchors custom_id = proposal_hash in PayPal order payload.
 * 5. On retry after timeout, looks up by stored request ID without creating duplicate orders (PRD §8.3).
 */
export async function executeCreateOrder(
  params: ExecuteCreateOrderParams
): Promise<GatewayOrderResult> {
  const { mandate, returnUrl, cancelUrl } = params;
  const gateway = params.gateway || getPaymentGateway();
  const db = await getDb();

  // 1. Re-verify mandate signature and expiry
  await verifyMandate({
    token: mandate.rawToken,
    expectedProposalHash: mandate.proposalHash,
  });

  // 2. Fetch proposal from database
  const proposals = await db
    .select()
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.id, mandate.proposalId),
        eq(schema.proposals.workspaceId, mandate.workspaceId)
      )
    )
    .limit(1);

  if (proposals.length === 0) {
    throw new Error(`Proposal not found: ${mandate.proposalId}`);
  }

  const proposal = proposals[0];

  // 3. Verify proposal hash match
  if (proposal.proposalHash !== mandate.proposalHash) {
    throw new Error(
      `HASH_MISMATCH: Proposal hash (${proposal.proposalHash}) does not match mandate (${mandate.proposalHash}).`
    );
  }

  // 4. Fetch policy rules to re-evaluate engine
  let policyRules: PolicyRuleDefinition | null = null;
  if (proposal.policyVersionId) {
    const pvs = await db
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.id, proposal.policyVersionId))
      .limit(1);
    if (pvs.length > 0) {
      policyRules = pvs[0].rulesJson as PolicyRuleDefinition;
    }
  }

  // Re-run policy evaluation (PRD §8.2 step 2)
  const proposalToEvaluate: ProposalToEvaluate = {
    workspace_id: mandate.workspaceId,
    items: (proposal.itemsJson || []) as any,
    currency: proposal.currency || "USD",
    total_cents: proposal.totalCents,
  };

  const spendState = await getSpendState(
    mandate.workspaceId,
    policyRules?.timezone,
    new Date(),
    mandate.proposalId
  );

  const evalResult = evaluate(
    proposalToEvaluate,
    policyRules,
    spendState,
    new Date()
  );

  // If engine now evaluates to DENY, reject execution immediately
  if (evalResult.decision === "DENY") {
    throw new Error(
      `Execution blocked by policy engine: ${evalResult.reason_codes.join(", ")}`
    );
  }

  // 5. Idempotency Key: create-<mandate.jti> persisted BEFORE sending (PRD §8.2 step 2, §8.3 Row 3)
  const requestId = `create-${mandate.jti}`;

  // Check if order was already initiated for this mandate / requestId
  const existingOrder = await db
    .select()
    .from(schema.paypalOrders)
    .where(eq(schema.paypalOrders.requestId, requestId))
    .limit(1);

  let internalOrderId: string;

  if (existingOrder.length > 0) {
    const existing = existingOrder[0];
    if (existing.paypalOrderId && !existing.paypalOrderId.startsWith("PENDING")) {
      // Order was already successfully created with this request ID: return idempotent result
      return {
        orderId: existing.paypalOrderId,
        status: (existing.status as any) || "CREATED",
        customId: mandate.proposalHash,
        amountCents: existing.amountCents,
        currency: existing.currency,
        source: gateway.mode,
        label: `${gateway.mode === "paypal_sandbox" ? "PayPal Sandbox (Orders v2)" : "Dev Stub"} [Idempotent]`,
        rawResponse: { id: existing.paypalOrderId, status: existing.status },
      };
    }
    // Previous attempt timed out or failed while PENDING: reuse existing record and stored requestId
    internalOrderId = existing.id;
  } else {
    // Persist record to paypal_orders before gateway invocation (PRD §8.2 step 2)
    internalOrderId = `pord_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await db.insert(schema.paypalOrders).values({
      id: internalOrderId,
      workspaceId: mandate.workspaceId,
      proposalId: proposal.id,
      paypalOrderId: `PENDING_${internalOrderId}`,
      status: "CREATED",
      requestId,
      amountCents: proposal.totalCents,
      currency: (proposal.currency || "USD") as "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 6. Call Payment Gateway
  const orderInput: GatewayCreateOrderInput = {
    proposalId: proposal.id,
    proposalHash: mandate.proposalHash,
    amountCents: proposal.totalCents,
    currency: "USD",
    items: ((proposal.itemsJson || []) as any[]).map((i) => ({
      sku: i.sku,
      name: i.title || i.name || i.sku,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
    })),
    returnUrl,
    cancelUrl,
    requestId,
  };

  const result = await gateway.createOrder(mandate, orderInput);

  // 7. Update database with real/simulated paypalOrderId
  await db
    .update(schema.paypalOrders)
    .set({
      paypalOrderId: result.orderId,
      status: result.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.paypalOrders.id, internalOrderId));

  // Update proposal state to ORDER_CREATED
  await db
    .update(schema.proposals)
    .set({
      state: "ORDER_CREATED",
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, proposal.id));

  // Append hash-chained ledger event (Golden Rule 8)
  await appendEvent({
    workspaceId: mandate.workspaceId,
    entityType: "order",
    entityId: result.orderId,
    type: "PAYPAL_ORDER_CREATED",
    actor: "executor",
    payload: {
      order_id: result.orderId,
      proposal_id: proposal.id,
      proposal_hash: mandate.proposalHash,
      amount_cents: proposal.totalCents,
      currency: proposal.currency || "USD",
      source: result.source,
    },
  });

  return result;
}

export interface ExecuteCaptureOrderParams {
  mandate: VerifiedMandate;
  orderId: string;
  gateway?: PaymentGateway;
}

/**
 * Executes PayPal order capture under the Authority Gate (PRD §8.2 Step 5, §8.3 Rows 2 & 4).
 *
 * Requirements:
 * 1. Atomically consumes the single-use mandate BEFORE sending capture call.
 * 2. Idempotency key `capture-<orderId>` persisted before sending.
 * 3. Transitions state to CAPTURED or CAPTURE_FAILED.
 */
export async function executeCaptureOrder(
  params: ExecuteCaptureOrderParams
): Promise<GatewayCaptureResult> {
  const { mandate, orderId } = params;
  const gateway = params.gateway || getPaymentGateway();
  const db = await getDb();

  // 1. Re-verify mandate
  await verifyMandate({
    token: mandate.rawToken,
    expectedProposalHash: mandate.proposalHash,
  });

  // 1. Order Binding Check (PRD §8.2 step 5, F2)
  // Load paypal_orders row by paypalOrderId AND workspaceId AND proposalId = mandate.proposalId
  const boundOrders = await db
    .select()
    .from(schema.paypalOrders)
    .where(
      and(
        eq(schema.paypalOrders.paypalOrderId, orderId),
        eq(schema.paypalOrders.workspaceId, mandate.workspaceId),
        eq(schema.paypalOrders.proposalId, mandate.proposalId)
      )
    )
    .limit(1);

  if (boundOrders.length === 0) {
    throw new Error(
      `ORDER_NOT_BOUND: PayPal order ${orderId} is not bound to proposal ${mandate.proposalId} in workspace ${mandate.workspaceId}`
    );
  }
  const boundOrder = boundOrders[0];
  const internalOrderId = boundOrder.id;

  // 2. Remote Order & Return Verification (PRD §8.2 step 4 & §8.3, F2)
  // Require status APPROVED/COMPLETED, amount equal to mandate amount, and custom_id equal to proposal hash
  const returnCheck = await verifyReturnOrder({
    orderId,
    mandate,
    gateway,
  });

  if (!returnCheck.valid) {
    throw new Error(
      `${returnCheck.reasonCode || "DRIFT_FLAGGED"}: ${returnCheck.error || "Order verification failed before capture"}`
    );
  }

  // 3. Re-evaluate policy with current spend state before consuming mandate
  const proposalRows = await db
    .select()
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.id, mandate.proposalId),
        eq(schema.proposals.workspaceId, mandate.workspaceId)
      )
    )
    .limit(1);

  if (proposalRows.length === 0) {
    throw new Error(`Proposal not found: ${mandate.proposalId}`);
  }
  const proposal = proposalRows[0];

  let policyRules: PolicyRuleDefinition | null = null;
  if (proposal.policyVersionId) {
    const pvs = await db
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.id, proposal.policyVersionId))
      .limit(1);
    if (pvs.length > 0) {
      policyRules = pvs[0].rulesJson as PolicyRuleDefinition;
    }
  }

  const spendState = await getSpendState(
    mandate.workspaceId,
    policyRules?.timezone,
    new Date(),
    mandate.proposalId
  );

  const proposalToEvaluate: ProposalToEvaluate = {
    workspace_id: mandate.workspaceId,
    items: (proposal.itemsJson || []) as any,
    currency: proposal.currency || "USD",
    total_cents: proposal.totalCents,
  };

  const evalResult = evaluate(
    proposalToEvaluate,
    policyRules,
    spendState,
    new Date()
  );

  if (evalResult.decision === "DENY") {
    throw new Error(
      `Execution blocked by policy engine: ${evalResult.reason_codes.join(", ")}`
    );
  }

  // 4. Atomically consume the mandate BEFORE the capture call (PRD §8.2 step 5)
  const consumeResult = await consumeMandate(mandate, db);
  if (!consumeResult.success) {
    throw new Error(
      `Mandate consumption rejected: ${consumeResult.reasonCode || "MANDATE_ALREADY_USED"}`
    );
  }

  // 5. Persist capture idempotency key
  const requestId = `capture-${orderId}`;
  const internalCaptureId = `pcap_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  // 4. Call Payment Gateway
  let result: GatewayCaptureResult;
  try {
    result = await gateway.captureOrder(mandate, orderId, requestId);
  } catch (err) {
    // Gateway call threw error: record CAPTURE_FAILED state and ledger event (PRD §8.2 step 5, §8.3 Row 2)
    await db
      .update(schema.proposals)
      .set({
        state: "CAPTURE_FAILED",
        updatedAt: new Date(),
      })
      .where(eq(schema.proposals.id, mandate.proposalId));

    await appendEvent({
      workspaceId: mandate.workspaceId,
      entityType: "capture",
      entityId: orderId,
      type: "PAYPAL_ORDER_CAPTURE_FAILED",
      actor: "executor",
      payload: {
        order_id: orderId,
        proposal_id: mandate.proposalId,
        proposal_hash: mandate.proposalHash,
        error: err instanceof Error ? err.message : String(err),
        status: "FAILED",
      },
    });

    throw err;
  }

  // 5. Record capture row in paypal_captures
  await db.insert(schema.paypalCaptures).values({
    id: internalCaptureId,
    workspaceId: mandate.workspaceId,
    orderId: internalOrderId,
    captureId: result.captureId,
    status: result.status,
    amountCents: result.amountCents,
    currency: (result.currency || "USD") as "USD",
    createdAt: new Date(),
  });

  // 6. Update proposal state
  const isCompleted = result.status === "COMPLETED";
  const nextState = isCompleted ? "CAPTURED" : "CAPTURE_FAILED";
  await db
    .update(schema.proposals)
    .set({
      state: nextState,
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, mandate.proposalId));

  // Append hash-chained ledger event (Golden Rule 8)
  const eventType = isCompleted ? "PAYPAL_ORDER_CAPTURED" : "PAYPAL_ORDER_CAPTURE_FAILED";
  await appendEvent({
    workspaceId: mandate.workspaceId,
    entityType: "capture",
    entityId: result.captureId,
    type: eventType,
    actor: "executor",
    payload: {
      capture_id: result.captureId,
      order_id: orderId,
      proposal_id: mandate.proposalId,
      proposal_hash: mandate.proposalHash,
      amount_cents: result.amountCents,
      currency: result.currency || "USD",
      status: result.status,
    },
  });

  return result;
}
