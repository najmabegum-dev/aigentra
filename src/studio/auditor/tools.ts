import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { z } from "zod";

/**
 * Metadata and specification for an Auditor Tool.
 * Invariant: Every auditor tool must be strictly read-only, never write, and never touch payments.
 */
export interface AuditorToolDefinition {
  name: "query_ledger" | "explain_decision" | "summarize_blocked";
  description: string;
  parameters: Record<string, unknown>;
  isReadOnly: true;
  canWrite: false;
  touchesPayments: false;
  category: "audit";
}

export const queryLedgerSchema = z.object({
  entity_type: z.string().optional(),
  actor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const explainDecisionSchema = z.object({
  decision_id: z.string().min(1),
});

export const summarizeBlockedSchema = z.object({
  range_hours: z.number().int().min(1).max(720).optional().default(24),
});

/**
 * Returns all registered Auditor Agent tools.
 * Invariant: All tools are 100% read-only.
 */
export function getAuditorTools(): AuditorToolDefinition[] {
  return [
    {
      name: "query_ledger",
      description:
        "Queries immutable hash-chained ledger events for the current workspace with optional filters for entity_type and actor.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            description: "Optional entity type (e.g. 'proposal', 'evaluation', 'order', 'capture', 'security')",
          },
          actor: {
            type: "string",
            description: "Optional actor identifier (e.g. 'agent:shopper', 'system:engine', 'webhook:paypal')",
          },
          limit: {
            type: "integer",
            description: "Maximum number of events to return (default 20, max 50)",
            default: 20,
          },
        },
      },
      isReadOnly: true,
      canWrite: false,
      touchesPayments: false,
      category: "audit",
    },
    {
      name: "explain_decision",
      description:
        "Retrieves a detailed evaluation decision by decision_id (or proposal_id), explaining every policy rule evaluation, threshold comparison, and reason code in plain human language.",
      parameters: {
        type: "object",
        properties: {
          decision_id: {
            type: "string",
            description: "The evaluation ID (e.g. 'eval_...') or proposal ID to audit and explain.",
          },
        },
        required: ["decision_id"],
      },
      isReadOnly: true,
      canWrite: false,
      touchesPayments: false,
      category: "audit",
    },
    {
      name: "summarize_blocked",
      description:
        "Analyzes all blocked proposals and security rejections within a time window (default 24h), reporting top rejection reasons, prompt injection attempts, and velocity limits.",
      parameters: {
        type: "object",
        properties: {
          range_hours: {
            type: "integer",
            description: "Time range in hours to inspect (default 24)",
            default: 24,
          },
        },
      },
      isReadOnly: true,
      canWrite: false,
      touchesPayments: false,
      category: "audit",
    },
  ];
}

/**
 * Executes an Auditor tool securely scoped to the caller's workspace_id.
 * Read-only database access only.
 */
export async function executeAuditorTool(
  toolName: string,
  args: Record<string, unknown>,
  workspaceId: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (!workspaceId) {
    return { ok: false, error: "Missing workspace identifier" };
  }

  try {
    switch (toolName) {
      case "query_ledger": {
        const parsed = queryLedgerSchema.parse(args);
        const limit = parsed.limit || 20;

        let queryConditions = [eq(schema.ledgerEvents.workspaceId, workspaceId)];
        if (parsed.entity_type) {
          queryConditions.push(eq(schema.ledgerEvents.entityType, parsed.entity_type));
        }
        if (parsed.actor) {
          queryConditions.push(eq(schema.ledgerEvents.actor, parsed.actor));
        }

        const rows = await db
          .select()
          .from(schema.ledgerEvents)
          .where(and(...queryConditions))
          .orderBy(desc(schema.ledgerEvents.seq))
          .limit(limit);

        const events = rows.map((r) => ({
          seq: r.seq,
          type: r.type,
          entity_type: r.entityType,
          entity_id: r.entityId,
          actor: r.actor,
          event_hash: r.eventHash,
          prev_hash: r.prevHash,
          payload: r.payloadJson,
          created_at: r.createdAt,
          workspace_id: r.workspaceId,
        }));

        return {
          ok: true,
          data: {
            workspace_id: workspaceId,
            count: events.length,
            events,
          },
        };
      }

      case "explain_decision": {
        const parsed = explainDecisionSchema.parse(args);
        const targetId = parsed.decision_id.trim();

        // Query by evaluation ID first
        let [evalRow] = await db
          .select()
          .from(schema.evaluations)
          .where(
            and(
              eq(schema.evaluations.workspaceId, workspaceId),
              eq(schema.evaluations.id, targetId)
            )
          );

        // Fallback: check if the user passed proposal ID
        if (!evalRow) {
          const [byProposal] = await db
            .select()
            .from(schema.evaluations)
            .where(
              and(
                eq(schema.evaluations.workspaceId, workspaceId),
                eq(schema.evaluations.proposalId, targetId)
              )
            );
          evalRow = byProposal;
        }

        if (!evalRow) {
          return {
            ok: false,
            error: `Decision or evaluation '${targetId}' not found in this workspace.`,
          };
        }

        // Fetch proposal details
        const [propRow] = await db
          .select()
          .from(schema.proposals)
          .where(
            and(
              eq(schema.proposals.workspaceId, workspaceId),
              eq(schema.proposals.id, evalRow.proposalId)
            )
          );

        const ruleResults = Array.isArray(evalRow.ruleResultsJson)
          ? evalRow.ruleResultsJson
          : [];
        const reasonCodes = Array.isArray(evalRow.reasonCodes)
          ? evalRow.reasonCodes
          : [];

        // Generate human-friendly explanation
        const explanations: string[] = [];
        if (evalRow.decision === "ALLOW") {
          explanations.push(
            `Proposal was fully APPROVED. All policy guardrails passed successfully.`
          );
        } else if (evalRow.decision === "REQUIRE_APPROVAL") {
          explanations.push(
            `Proposal requires HUMAN APPROVAL because it exceeded the autonomous authorization threshold.`
          );
        } else {
          explanations.push(
            `Proposal was BLOCKED (DENY) due to ${reasonCodes.length} guardrail violation(s): ${reasonCodes.join(", ")}.`
          );
        }

        for (const res of ruleResults as any[]) {
          if (!res.passed) {
            explanations.push(
              `- Rule '${res.rule}' failed with reason '${res.reason || res.reason_code}'.`
            );
          }
        }

        const plainSummary = explanations.join("\n");

        return {
          ok: true,
          data: {
            decision_id: evalRow.id,
            proposal_id: evalRow.proposalId,
            decision: evalRow.decision,
            reason_codes: reasonCodes,
            rule_results: ruleResults,
            proposal_total_cents: propRow?.totalCents ?? null,
            proposal_currency: propRow?.currency ?? "USD",
            created_at: evalRow.createdAt,
            plain_summary: plainSummary,
          },
        };
      }

      case "summarize_blocked": {
        const parsed = summarizeBlockedSchema.parse(args);
        const cutoff = new Date(Date.now() - parsed.range_hours * 60 * 60 * 1000);

        // Fetch denied evaluations
        const deniedRows = await db
          .select()
          .from(schema.evaluations)
          .where(
            and(
              eq(schema.evaluations.workspaceId, workspaceId),
              eq(schema.evaluations.decision, "DENY"),
              gte(schema.evaluations.createdAt, cutoff)
            )
          )
          .orderBy(desc(schema.evaluations.createdAt));

        // Fetch attack lab runs or security ledger events if any
        const attacks = await db
          .select()
          .from(schema.attackRuns)
          .where(
            and(
              eq(schema.attackRuns.workspaceId, workspaceId),
              gte(schema.attackRuns.createdAt, cutoff)
            )
          );

        // Aggregate reason codes
        const reasonBreakdown: Record<string, number> = {};
        let promptInjectionHits = 0;

        for (const row of deniedRows) {
          const codes = Array.isArray(row.reasonCodes) ? row.reasonCodes : [];
          for (const code of codes) {
            const key = String(code);
            reasonBreakdown[key] = (reasonBreakdown[key] || 0) + 1;
            if (
              key.includes("INJECTION") ||
              key.includes("PROMPT") ||
              key.includes("ATTACK")
            ) {
              promptInjectionHits++;
            }
          }
        }

        for (const att of attacks) {
          if (att.scenario.includes("A1") || att.scenario.includes("injection")) {
            promptInjectionHits++;
          }
        }

        const topReasons = Object.entries(reasonBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([code, count]) => `${code} (${count})`)
          .join(", ") || "None";

        const summary = `Audited ${deniedRows.length} blocked attempts across the past ${parsed.range_hours} hour(s).\n` +
          `- Total blocked attempts: ${deniedRows.length}\n` +
          `- Prompt injection / untrusted text indicators: ${promptInjectionHits}\n` +
          `- Top rejection reasons: ${topReasons}\n` +
          `- Attack Lab runs verified: ${attacks.length}`;

        return {
          ok: true,
          data: {
            workspace_id: workspaceId,
            range_hours: parsed.range_hours,
            total_blocked: deniedRows.length,
            prompt_injection_hits: promptInjectionHits,
            reason_breakdown: reasonBreakdown,
            attack_runs_verified: attacks.length,
            summary,
          },
        };
      }

      default:
        return { ok: false, error: `Unknown auditor tool: ${toolName}` };
    }
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to execute tool" };
  }
}
