import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { SpendState } from "./types";

/**
 * Returns a calendar day string formatted as YYYY-MM-DD for a given date in a specific timezone.
 */
function getCalendarDay(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    // Fallback if invalid timezone is passed
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Computes the authoritative SpendState for a workspace (PRD §6.1, §6.2).
 * Reads:
 * 1. kill_switch from workspaces table.
 * 2. daily_captured_cents: sum of CAPTURED proposals for workspace within the policy's calendar day.
 * 3. daily_reserved_cents: sum of proposals in MANDATED, ORDER_CREATED, or BUYER_APPROVED states,
 *    excluding excludeProposalId if provided (to avoid double-counting the proposal currently undergoing execution).
 */
export async function getSpendState(
  workspaceId: string,
  policyTimezone: string = "Asia/Kolkata",
  now: Date = new Date(),
  excludeProposalId?: string
): Promise<SpendState> {
  const db = await getDb();

  // 1. Fetch workspace for killSwitch
  const workspaceRows = await db
    .select({ killSwitch: schema.workspaces.killSwitch })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);

  const killSwitch = workspaceRows.length > 0 ? Boolean(workspaceRows[0].killSwitch) : false;

  // 2. Fetch all proposals for this workspace
  const workspaceProposals = await db
    .select({
      id: schema.proposals.id,
      state: schema.proposals.state,
      totalCents: schema.proposals.totalCents,
      createdAt: schema.proposals.createdAt,
      updatedAt: schema.proposals.updatedAt,
    })
    .from(schema.proposals)
    .where(eq(schema.proposals.workspaceId, workspaceId));

  const targetDay = getCalendarDay(now, policyTimezone);

  let dailyCapturedCents = 0;
  let dailyReservedCents = 0;

  const reservedStates = new Set(["MANDATED", "ORDER_CREATED", "BUYER_APPROVED"]);

  for (const prop of workspaceProposals) {
    if (prop.state === "CAPTURED") {
      const propDate = prop.updatedAt || prop.createdAt;
      const propDay = getCalendarDay(new Date(propDate), policyTimezone);
      if (propDay === targetDay) {
        dailyCapturedCents += prop.totalCents || 0;
      }
    } else if (reservedStates.has(prop.state)) {
      if (!excludeProposalId || prop.id !== excludeProposalId) {
        dailyReservedCents += prop.totalCents || 0;
      }
    }
  }

  return {
    kill_switch: killSwitch,
    daily_captured_cents: dailyCapturedCents,
    daily_reserved_cents: dailyReservedCents,
  };
}
