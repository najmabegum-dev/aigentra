import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";
import { policyFormSchema } from "@/lib/policies";

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

  // Attach latest version and full version list to each policy
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

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing or invalid workspace session" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = policyFormSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation error",
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rules = parseResult.data;
    const policyId = `pol_${crypto.randomBytes(8).toString("hex")}`;
    const policyVersionId = `pv_${crypto.randomBytes(8).toString("hex")}`;

    // 1. Insert Policy
    await db.insert(schema.policies).values({
      id: policyId,
      workspaceId,
    });

    // 2. Insert Version 1 (Immutable)
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      workspaceId,
      policyId,
      version: 1,
      rulesJson: rules,
    });

    return NextResponse.json(
      {
        ok: true,
        policy: {
          id: policyId,
          workspaceId,
          version: 1,
          rules,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create policy:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
