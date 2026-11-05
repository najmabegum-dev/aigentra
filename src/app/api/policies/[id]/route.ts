import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: Request, { params }: RouteParams) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing or invalid workspace session" },
      { status: 401 }
    );
  }

  const { id: policyId } = params;

  // Golden Rule 9: Query strictly scoped by workspace_id and policy id
  const [policy] = await db
    .select()
    .from(schema.policies)
    .where(and(eq(schema.policies.id, policyId), eq(schema.policies.workspaceId, workspaceId)));

  if (!policy) {
    // Return 404 to avoid leaking whether the policy exists under another tenant
    return NextResponse.json(
      { ok: false, error: "Policy not found", code: "POLICY_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Golden Rule 9: Query versions strictly scoped by workspace_id and policy id
  const versions = await db
    .select()
    .from(schema.policyVersions)
    .where(
      and(
        eq(schema.policyVersions.policyId, policyId),
        eq(schema.policyVersions.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(schema.policyVersions.version));

  return NextResponse.json({
    ok: true,
    policy: {
      id: policy.id,
      workspaceId: policy.workspaceId,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      latestVersion: versions[0] ?? null,
      versions,
    },
  });
}
