import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { db } from "@/lib/db";
import { attackRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/attack-lab/runs
 *
 * Retrieves historical attack run results for the authenticated workspace.
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

    const runs = await db
      .select()
      .from(attackRuns)
      .where(eq(attackRuns.workspaceId, workspaceId))
      .orderBy(desc(attackRuns.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error("Error fetching attack runs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected internal server error occurred while fetching attack runs.",
      },
      { status: 500 }
    );
  }
}
