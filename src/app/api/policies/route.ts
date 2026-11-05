import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing or invalid workspace session" },
      { status: 401 }
    );
  }

  // Golden Rule 9: Every database read must filter by workspace_id
  const userPolicies = await db
    .select()
    .from(schema.policies)
    .where(eq(schema.policies.workspaceId, workspaceId))
    .orderBy(desc(schema.policies.createdAt));

  const versions = await db
    .select()
    .from(schema.policyVersions)
    .where(eq(schema.policyVersions.workspaceId, workspaceId))
    .orderBy(desc(schema.policyVersions.version));

  // Attach latest version to each policy
  const policiesWithVersions = userPolicies.map((p) => {
    const policyVersions = versions.filter((v) => v.policyId === p.id);
    const activeVersion = policyVersions[0] ?? null;
    return {
      id: p.id,
      workspaceId: p.workspaceId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      latestVersion: activeVersion,
      versions: policyVersions,
    };
  });

  return NextResponse.json({
    ok: true,
    policies: policiesWithVersions,
  });
}
