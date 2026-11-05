import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";
import { policyFormSchema } from "@/lib/policies";

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

export async function PUT(req: Request, { params }: RouteParams) {
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

    const nextVersionNumber = (latestVersion?.version ?? 0) + 1;
    const newVersionId = `pv_${crypto.randomBytes(8).toString("hex")}`;

    // PRD F2: Each material change creates an immutable new version row
    await db.insert(schema.policyVersions).values({
      id: newVersionId,
      workspaceId,
      policyId,
      version: nextVersionNumber,
      rulesJson: rules,
    });

    await db
      .update(schema.policies)
      .set({ updatedAt: new Date() })
      .where(and(eq(schema.policies.id, policyId), eq(schema.policies.workspaceId, workspaceId)));

    return NextResponse.json({
      ok: true,
      policy: {
        id: policy.id,
        workspaceId: policy.workspaceId,
        version: nextVersionNumber,
        versionId: newVersionId,
        rules,
      },
    });
  } catch (error) {
    console.error("Failed to update policy:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
