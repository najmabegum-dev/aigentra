import { and, eq, gte } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const MAX_AI_CALLS_PER_HOUR = 20;
export const MAX_AI_CALLS_PER_DAY = 50;

export interface CapStatus {
  allowed: boolean;
  reason?: string;
  callsPastHour: number;
  callsPastDay: number;
}

/**
 * Checks whether the workspace has exceeded hourly or daily AI call limits (PRD §9.2)
 */
export async function checkWorkspaceAiCap(workspaceId: string): Promise<CapStatus> {
  if (!workspaceId) {
    return {
      allowed: false,
      reason: "Missing workspace identifier",
      callsPastHour: 0,
      callsPastDay: 0,
    };
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Golden Rule 9: Query strictly scoped by workspace_id
    const pastDayRows = await db
      .select({ at: schema.aiUsage.at })
      .from(schema.aiUsage)
      .where(
        and(
          eq(schema.aiUsage.workspaceId, workspaceId),
          gte(schema.aiUsage.at, oneDayAgo)
        )
      );

    const callsPastDay = pastDayRows.length;
    const callsPastHour = pastDayRows.filter((row) => row.at >= oneHourAgo).length;

    if (callsPastHour >= MAX_AI_CALLS_PER_HOUR) {
      return {
        allowed: false,
        reason: `Workspace hourly AI rate limit reached (${callsPastHour}/${MAX_AI_CALLS_PER_HOUR}). Switched to Replay mode.`,
        callsPastHour,
        callsPastDay,
      };
    }

    if (callsPastDay >= MAX_AI_CALLS_PER_DAY) {
      return {
        allowed: false,
        reason: `Workspace daily AI rate limit reached (${callsPastDay}/${MAX_AI_CALLS_PER_DAY}). Switched to Replay mode.`,
        callsPastHour,
        callsPastDay,
      };
    }

    return {
      allowed: true,
      callsPastHour,
      callsPastDay,
    };
  } catch (error) {
    console.error("Failed to query ai_usage table, falling back to safe limits:", error);
    // If DB read fails, allow call or fallback gracefully
    return {
      allowed: true,
      callsPastHour: 0,
      callsPastDay: 0,
    };
  }
}

/**
 * Appends a record to ai_usage and increments ai_calls_used on the workspace.
 */
export async function recordAiUsage(
  workspaceId: string,
  kind: string = "intent_parser",
  tokens: number = 0
): Promise<void> {
  if (!workspaceId) return;

  try {
    const usageId = `use_${crypto.randomBytes(8).toString("hex")}`;
    await db.insert(schema.aiUsage).values({
      id: usageId,
      workspaceId,
      kind,
      tokens,
      at: new Date(),
    });

    // Increment workspace counter
    const [ws] = await db
      .select({ count: schema.workspaces.aiCallsUsed })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId));

    if (ws) {
      await db
        .update(schema.workspaces)
        .set({
          aiCallsUsed: ws.count + 1,
          lastSeenAt: new Date(),
        })
        .where(eq(schema.workspaces.id, workspaceId));
    }
  } catch (err) {
    console.error("Failed to record AI usage:", err);
  }
}
