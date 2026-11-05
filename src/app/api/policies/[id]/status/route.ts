import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";
import type { PolicyRuleDefinition, PolicyStatus } from "@/rooms/authorize/types";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: Request, { params }: RouteParams) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing or invalid workspace session" },
      { status: 401 }
    );
  }

  const { id: policyId } = params;

  // Golden Rule 9: Query strictly scoped by workspace_id
  const [policy] = await db
    .select()
    .from(schema.policies)
    .where(and(eq(schema.policies.id, policyId), eq(schema.policies.workspaceId, workspaceId)));

  if (!policy) {
    return NextResponse.json(
      { ok: false, error: "Policy not found", code: "POLICY_NOT_FOUND" },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const newStatus = body?.status as PolicyStatus;

    if (!newStatus || !["ACTIVE", "PAUSED", "REVOKED"].includes(newStatus)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status. Must be ACTIVE, PAUSED, or REVOKED" },
        { status: 400 }
      );
    }

    // Get current latest version
    const [latestVersion] = await db
      .select()
      .from(schema.policyVersions)
      .where(
        and(
          eq(schema.policyVersions.policyId, policyId),
          eq(schema.policyVersions.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(schema.policyVersions.version))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json(
        { ok: false, error: "No policy versions found" },
        { status: 404 }
      );
    }

    const currentRules = latestVersion.rulesJson as PolicyRuleDefinition;

    // Terminal state check
    if (currentRules.status === "REVOKED") {
      return NextResponse.json(
        { ok: false, error: "Policy is REVOKED and terminal. Cannot change status." },
        { status: 400 }
      );
    }

    // Material change: create new immutable version
    const updatedRules: PolicyRuleDefinition = {
      ...currentRules,
      status: newStatus,
    };

    const nextVersionNumber = latestVersion.version + 1;
    const newVersionId = `pv_${crypto.randomBytes(8).toString("hex")}`;

    await db.insert(schema.policyVersions).values({
      id: newVersionId,
      workspaceId,
      policyId,
      version: nextVersionNumber,
      rulesJson: updatedRules,
    });

    await db
      .update(schema.policies)
      .set({ updatedAt: new Date() })
      .where(and(eq(schema.policies.id, policyId), eq(schema.policies.workspaceId, workspaceId)));

    return NextResponse.json({
      ok: true,
      policy: {
        id: policy.id,
        version: nextVersionNumber,
        versionId: newVersionId,
        rules: updatedRules,
      },
    });
  } catch (error) {
    console.error("Failed to update policy status:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
