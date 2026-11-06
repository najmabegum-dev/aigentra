import { generateText, tool } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/rooms/propose/ai";
import { checkWorkspaceAiCap, recordAiUsage } from "@/rooms/propose/caps";
import {
  executeAuditorTool,
  queryLedgerSchema,
  explainDecisionSchema,
  summarizeBlockedSchema,
} from "./tools";

export interface AuditorChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AuditorToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AuditorChatResult {
  ok: boolean;
  mode: "live" | "replay";
  reason?: string;
  message: string;
  toolCalls: AuditorToolCallRecord[];
}

const AUDITOR_SYSTEM_PROMPT = `You are AIGENTRA's Financial Auditor Agent.
AIGENTRA is an authoritative financial authorization layer between AI agents and PayPal.
Your role is strictly READ-ONLY auditing of:
1. Immutable hash-chained ledger events (using query_ledger).
2. Autonomous policy evaluation decisions and reason codes (using explain_decision).
3. Blocked authorization attempts and adversarial prompt injection scans (using summarize_blocked).

SAFETY INVARIANTS:
- You have ZERO ability to create orders, capture funds, issue refunds, or modify policies.
- Always provide clear, objective, evidence-backed explanations referencing sequence numbers, decision IDs, and policy rule thresholds.
- Be concise, professional, and highlight security or guardrail triggers (e.g. CART_MAX_EXCEEDED, PROMPT_INJECTION_DETECTED).`;

/**
 * Deterministic Replay Mode fallback when Gemini key is absent or workspace AI cap is exceeded.
 */
async function runReplayAudit(
  prompt: string,
  workspaceId: string,
  reason: string
): Promise<AuditorChatResult> {
  const lower = prompt.toLowerCase();
  const toolCalls: AuditorToolCallRecord[] = [];

  let toolToRun = "summarize_blocked";
  let toolArgs: Record<string, unknown> = { range_hours: 24 };

  if (lower.includes("ledger") || lower.includes("event") || lower.includes("chain") || lower.includes("hash")) {
    toolToRun = "query_ledger";
    toolArgs = { limit: 10 };
  } else if (lower.includes("eval_") || lower.includes("prop_") || lower.includes("decision") || lower.includes("explain")) {
    // Try to extract an ID from the prompt
    const idMatch = prompt.match(/(eval_[a-zA-Z0-9_-]+|prop_[a-zA-Z0-9_-]+)/);
    if (idMatch) {
      toolToRun = "explain_decision";
      toolArgs = { decision_id: idMatch[1] };
    } else {
      toolToRun = "summarize_blocked";
      toolArgs = { range_hours: 24 };
    }
  }

  const toolExec = await executeAuditorTool(toolToRun, toolArgs, workspaceId);
  toolCalls.push({
    toolName: toolToRun,
    args: toolArgs,
    result: toolExec.data || toolExec.error,
  });

  let message = "";
  if (toolToRun === "query_ledger") {
    const count = toolExec.data?.events?.length || 0;
    message = `### Ledger Audit Report (Replay Mode)\n\n` +
      `Inspected **${count}** hash-chained ledger events for workspace \`${workspaceId}\`.\n\n` +
      (count > 0
        ? toolExec.data.events
            .slice(0, 5)
            .map(
              (e: any) =>
                `- **Seq #${e.seq}** (\`${e.type}\`): Entity \`${e.entity_type}:${e.entity_id}\` by actor \`${e.actor}\`. Hash: \`${e.event_hash?.slice(0, 12)}...\``
            )
            .join("\n")
        : "No ledger events recorded yet in this workspace.") +
      `\n\n*All events are chained by SHA-256 prev_hash.*`;
  } else if (toolToRun === "explain_decision") {
    if (toolExec.ok && toolExec.data) {
      message = `### Decision Explanation for \`${toolExec.data.decision_id}\`\n\n` +
        `**Outcome**: \`${toolExec.data.decision}\`\n` +
        `**Reason Codes**: ${toolExec.data.reason_codes?.join(", ") || "None"}\n\n` +
        `**Detailed Evaluation Summary**:\n${toolExec.data.plain_summary}`;
    } else {
      message = `### Decision Audit\n\nCould not locate evaluation with that identifier in workspace \`${workspaceId}\`. Ensure the decision or proposal ID exists.`;
    }
  } else {
    message = `### Blocked Attempts & Threat Audit (Replay Mode)\n\n` +
      (toolExec.data?.summary ||
        `No blocked authorization attempts detected in the past 24 hours.`);
  }

  return {
    ok: true,
    mode: "replay",
    reason,
    message,
    toolCalls,
  };
}

/**
 * Runs Auditor Agent conversation.
 * Scoped strictly by workspaceId. Read-only tools only.
 */
export async function runAuditorAgent(
  prompt: string,
  workspaceId: string,
  history: AuditorChatMessage[] = []
): Promise<AuditorChatResult> {
  const trimmed = (prompt || "").trim();
  if (!trimmed) {
    return runReplayAudit("summarize blocked attempts", workspaceId, "Empty prompt provided");
  }

  // 1. Check workspace AI cap
  const capStatus = await checkWorkspaceAiCap(workspaceId);
  if (!capStatus.allowed) {
    return runReplayAudit(trimmed, workspaceId, capStatus.reason || "AI rate limit reached");
  }

  // 2. Resolve language model
  const model = getLanguageModel();
  if (!model) {
    return runReplayAudit(
      trimmed,
      workspaceId,
      "GEMINI_API_KEY not configured. Running in deterministic Replay mode."
    );
  }

  // 3. Setup Read-Only Tools for the AI SDK
  const toolCallsMade: AuditorToolCallRecord[] = [];

  try {
    const tools = {
      query_ledger: tool({
        description:
          "Queries immutable hash-chained ledger events for the current workspace with optional filters.",
        inputSchema: queryLedgerSchema,
        execute: async (args: z.infer<typeof queryLedgerSchema>) => {
          const res = await executeAuditorTool("query_ledger", args, workspaceId);
          toolCallsMade.push({
            toolName: "query_ledger",
            args: args as Record<string, unknown>,
            result: res.data || res.error,
          });
          return res.data || { error: res.error };
        },
      }),

      explain_decision: tool({
        description:
          "Retrieves an evaluation decision by decision_id (or proposal_id), explaining every policy rule and reason code.",
        inputSchema: explainDecisionSchema,
        execute: async (args: z.infer<typeof explainDecisionSchema>) => {
          const res = await executeAuditorTool("explain_decision", args, workspaceId);
          toolCallsMade.push({
            toolName: "explain_decision",
            args: args as Record<string, unknown>,
            result: res.data || res.error,
          });
          return res.data || { error: res.error };
        },
      }),

      summarize_blocked: tool({
        description:
          "Summarizes blocked proposals, prompt injection indicators, and velocity limits within a time window (range_hours).",
        inputSchema: summarizeBlockedSchema,
        execute: async (args: z.infer<typeof summarizeBlockedSchema>) => {
          const res = await executeAuditorTool("summarize_blocked", args, workspaceId);
          toolCallsMade.push({
            toolName: "summarize_blocked",
            args: args as Record<string, unknown>,
            result: res.data || res.error,
          });
          return res.data || { error: res.error };
        },
      }),
    };

    const conversation = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));
    conversation.push({ role: "user", content: trimmed });

    const result = await generateText({
      model,
      system: AUDITOR_SYSTEM_PROMPT,
      messages: conversation,
      tools,
    });

    // Record AI token usage safely
    const usageObj = result.usage as any;
    const tokens =
      (usageObj?.inputTokens || usageObj?.promptTokens || 0) +
      (usageObj?.outputTokens || usageObj?.completionTokens || 0);
    await recordAiUsage(workspaceId, "auditor", tokens);

    // If tools were called directly by the model, synthesize answer if needed
    let finalMessage = result.text;
    if (!finalMessage && toolCallsMade.length > 0) {
      finalMessage = `Audited workspace data using ${toolCallsMade.map((t) => t.toolName).join(", ")}.`;
    }

    return {
      ok: true,
      mode: "live",
      message: finalMessage || "Audit complete.",
      toolCalls: toolCallsMade,
    };
  } catch (error: any) {
    console.warn("Live LLM Auditor call failed, falling back to Replay:", error?.message);
    return runReplayAudit(
      trimmed,
      workspaceId,
      `AI Provider error: ${error?.message || "Generation error"}. Switched to Replay mode.`
    );
  }
}
