import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { db } from "@/lib/db";
import {
  ledgerEvents,
  proposals,
  evaluations,
  paypalCaptures,
} from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio-data
 *
 * Returns workspace-scoped arrays for AG Studio Control Tower:
 * - ledger (audit chain events)
 * - proposals (agent shopping proposals)
 * - decisions (policy engine evaluations)
 * - captures (confirmed or reconciled PayPal captures)
 *
 * Golden Rule 9: Every query is scoped by workspace_id.
 * PRD §10.4: All data labelled Sandbox; seeded fallback rows clearly tagged "seeded".
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active workspace session required" },
        { status: 401 }
      );
    }

    // 1. Fetch real workspace rows scoped by workspace_id
    const [rawLedger, rawProposals, rawDecisions, rawCaptures] = await Promise.all([
      db
        .select()
        .from(ledgerEvents)
        .where(eq(ledgerEvents.workspaceId, workspaceId))
        .orderBy(asc(ledgerEvents.seq)),
      db
        .select()
        .from(proposals)
        .where(eq(proposals.workspaceId, workspaceId))
        .orderBy(desc(proposals.createdAt)),
      db
        .select()
        .from(evaluations)
        .where(eq(evaluations.workspaceId, workspaceId))
        .orderBy(desc(evaluations.createdAt)),
      db
        .select()
        .from(paypalCaptures)
        .where(eq(paypalCaptures.workspaceId, workspaceId))
        .orderBy(desc(paypalCaptures.createdAt)),
    ]);

    // 2. Format live data
    const ledger = rawLedger.map((row) => ({
      id: row.id,
      seq: row.seq,
      entity_type: row.entityType,
      entity_id: row.entityId,
      type: row.type,
      actor: row.actor,
      payload: row.payloadJson,
      prev_hash: row.prevHash,
      event_hash: row.eventHash,
      created_at: row.createdAt.toISOString(),
      source: "live",
      environment: "Sandbox",
    }));

    const formattedProposals = rawProposals.map((row) => {
      const items = Array.isArray(row.itemsJson) ? row.itemsJson : [];
      return {
        id: row.id,
        proposal_hash: row.proposalHash,
        total_cents: row.totalCents,
        total_formatted: `$${(row.totalCents / 100).toFixed(2)}`,
        currency: row.currency,
        state: row.state,
        items_count: items.length,
        items,
        created_at: row.createdAt.toISOString(),
        source: "live",
        environment: "Sandbox",
      };
    });

    const decisions = rawDecisions.map((row) => ({
      id: row.id,
      proposal_id: row.proposalId,
      decision: row.decision,
      reason_codes: row.reasonCodes,
      rule_results: row.ruleResultsJson,
      created_at: row.createdAt.toISOString(),
      source: "live",
      environment: "Sandbox",
    }));

    const captures = rawCaptures.map((row) => ({
      id: row.id,
      order_id: row.orderId,
      capture_id: row.captureId,
      status: row.status,
      amount_cents: row.amountCents,
      amount_formatted: `$${(row.amountCents / 100).toFixed(2)}`,
      currency: row.currency,
      created_at: row.createdAt.toISOString(),
      source: "live",
      environment: "Sandbox",
    }));

    // 3. Fallback seeded data if fresh workspace has no transaction history yet
    const seededFallback = getSeededStudioData(workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId,
      environment: "Sandbox",
      ledger: ledger.length > 0 ? ledger : seededFallback.ledger,
      proposals: formattedProposals.length > 0 ? formattedProposals : seededFallback.proposals,
      decisions: decisions.length > 0 ? decisions : seededFallback.decisions,
      captures: captures.length > 0 ? captures : seededFallback.captures,
      counts: {
        ledger: ledger.length > 0 ? ledger.length : seededFallback.ledger.length,
        proposals: formattedProposals.length > 0 ? formattedProposals.length : seededFallback.proposals.length,
        decisions: decisions.length > 0 ? decisions.length : seededFallback.decisions.length,
        captures: captures.length > 0 ? captures.length : seededFallback.captures.length,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving studio data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected internal server error occurred while retrieving studio data.",
      },
      { status: 500 }
    );
  }
}

function getSeededStudioData(workspaceId: string) {
  const now = Date.now();
  return {
    ledger: [
      {
        id: "evt_seed_1",
        seq: 1,
        entity_type: "policy",
        entity_id: "pol_seed_01",
        type: "POLICY_ACTIVATED",
        actor: "system",
        payload: { policy_name: "Home Office Guardrails", cart_max_cents: 15000 },
        prev_hash: "0".repeat(64),
        event_hash: "a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
        created_at: new Date(now - 7200_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
      {
        id: "evt_seed_2",
        seq: 2,
        entity_type: "proposal",
        entity_id: "prop_seed_01",
        type: "PROPOSAL_CREATED",
        actor: "agent",
        payload: { total_cents: 8499, merchant: "keychron.com" },
        prev_hash: "a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
        event_hash: "b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef01",
        created_at: new Date(now - 3600_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
      {
        id: "evt_seed_3",
        seq: 3,
        entity_type: "order",
        entity_id: "DEV-ORDER-SEED-01",
        type: "ORDER_CAPTURED",
        actor: "executor",
        payload: { capture_id: "DEV-CAP-SEED-01", amount_cents: 8499 },
        prev_hash: "b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef01",
        event_hash: "c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef0102",
        created_at: new Date(now - 1800_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
    ],
    proposals: [
      {
        id: "prop_seed_01",
        proposal_hash: "hash_seed_keyboard_k2",
        total_cents: 8499,
        total_formatted: "$84.99",
        currency: "USD",
        state: "CAPTURED",
        items_count: 1,
        items: [
          {
            sku: "SKU-KEYBOARD-01",
            title: "Keychron K2 Wireless Mechanical Keyboard",
            merchant_domain: "keychron.com",
            unit_price_cents: 8499,
            quantity: 1,
          },
        ],
        created_at: new Date(now - 3600_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
      {
        id: "prop_seed_02",
        proposal_hash: "hash_seed_monitor_denied",
        total_cents: 38999,
        total_formatted: "$389.99",
        currency: "USD",
        state: "DENIED",
        items_count: 1,
        items: [
          {
            sku: "SKU-MONITOR-01",
            title: "Dell UltraSharp 27-inch 4K Monitor",
            merchant_domain: "dell.com",
            unit_price_cents: 38999,
            quantity: 1,
          },
        ],
        created_at: new Date(now - 1200_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
    ],
    decisions: [
      {
        id: "eval_seed_01",
        proposal_id: "prop_seed_01",
        decision: "REQUIRE_APPROVAL",
        reason_codes: ["OVER_APPROVAL_THRESHOLD"],
        rule_results: [
          { rule: "cart_cap", passed: true, decision: "ALLOW" },
          { rule: "approval_threshold", passed: false, decision: "REQUIRE_APPROVAL" },
        ],
        created_at: new Date(now - 3500_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
      {
        id: "eval_seed_02",
        proposal_id: "prop_seed_02",
        decision: "DENY",
        reason_codes: ["OVER_CART_CAP", "OVER_PER_ITEM_CAP"],
        rule_results: [
          { rule: "cart_cap", passed: false, decision: "DENY" },
          { rule: "per_item_cap", passed: false, decision: "DENY" },
        ],
        created_at: new Date(now - 1100_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
    ],
    captures: [
      {
        id: "cap_seed_01",
        order_id: "ord_seed_01",
        capture_id: "DEV-CAP-SEED-01",
        status: "COMPLETED",
        amount_cents: 8499,
        amount_formatted: "$84.99",
        currency: "USD",
        created_at: new Date(now - 1800_000).toISOString(),
        source: "seeded",
        environment: "Sandbox",
      },
    ],
  };
}
