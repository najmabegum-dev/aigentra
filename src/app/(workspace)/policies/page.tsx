import { cookies } from "next/headers";
import { WORKSPACE_COOKIE_NAME, verifyWorkspaceId } from "@/lib/session";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PolicyStudioView, type PolicyData } from "@/ui/policy-studio/policy-studio-view";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const cookieStore = cookies();
  const rawCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const workspaceId = verifyWorkspaceId(rawCookie);

  if (!workspaceId) {
    return null;
  }

  // Golden Rule 9: Query strictly scoped by workspace_id
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

  const [ws] = await db
    .select({ killSwitch: schema.workspaces.killSwitch })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));

  const policiesWithVersions: PolicyData[] = userPolicies.map((p) => {
    const policyVersions = versions
      .filter((v) => v.policyId === p.id)
      .map((v) => ({
        id: v.id,
        version: v.version,
        createdAt: v.createdAt.toISOString(),
        rulesJson: v.rulesJson,
      }));

    return {
      id: p.id,
      workspaceId: p.workspaceId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      latestVersion: policyVersions[0] ?? null,
      versions: policyVersions,
    };
  });

  return (
    <PolicyStudioView
      initialPolicies={policiesWithVersions}
      initialKillSwitch={ws?.killSwitch ?? false}
    />
  );
}
