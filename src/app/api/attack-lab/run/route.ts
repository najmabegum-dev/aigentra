import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import {
  runScenario,
  runAllAttackScenarios,
  ScenarioId,
  ATTACK_SCENARIOS,
} from "@/rooms/verify/attackLab/scenarios";

export const dynamic = "force-dynamic";

/**
 * POST /api/attack-lab/run
 *
 * Runs one or all adversarial attack scenarios (PRD §9.4, F10).
 * Proves policy enforcement, signature gates, hash-chain integrity,
 * and confirms 0 PayPal executions across all attacks.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active workspace session required" },
        { status: 401 }
      );
    }

    let scenario: string | undefined;
    try {
      const body = await request.json();
      scenario = body.scenario;
    } catch {
      // Empty body implies run all
    }

    if (scenario && scenario !== "ALL") {
      const validIds: ScenarioId[] = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
      if (!validIds.includes(scenario as ScenarioId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid scenario '${scenario}'. Must be one of: ${validIds.join(", ")} or 'ALL'`,
          },
          { status: 400 }
        );
      }

      const result = await runScenario(scenario as ScenarioId, workspaceId);
      return NextResponse.json({
        success: true,
        results: [result],
      });
    }

    // Default: run all 7 scenarios in sequence
    const results = await runAllAttackScenarios(workspaceId);
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute attack lab scenario",
      },
      { status: 500 }
    );
  }
}
