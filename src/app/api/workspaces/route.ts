import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  signWorkspaceId,
  WORKSPACE_COOKIE_NAME,
  WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  parseWorkspaceCookie,
} from "@/lib/session";
import { createSamplePolicyRules, SAMPLE_POLICY_NAME } from "@/lib/policies";

export async function POST(req: Request) {
  try {
    const workspaceId = `ws_${crypto.randomBytes(8).toString("hex")}`;
    const policyId = `pol_${crypto.randomBytes(8).toString("hex")}`;
    const policyVersionId = `pv_${crypto.randomBytes(8).toString("hex")}`;

    const rules = createSamplePolicyRules();

    // 1. Create Workspace
    await db.insert(schema.workspaces).values({
      id: workspaceId,
      aiCallsUsed: 0,
      killSwitch: false,
    });

    // 2. Create Policy
    await db.insert(schema.policies).values({
      id: policyId,
      workspaceId,
    });

    // 3. Seed Version 1 (Immutable)
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      workspaceId,
      policyId,
      version: 1,
      rulesJson: rules,
    });

    // 4. Sign Workspace Cookie
    const signedCookieValue = signWorkspaceId(workspaceId);

    const response = NextResponse.json(
      {
        ok: true,
        workspace: {
          id: workspaceId,
        },
        policy: {
          id: policyId,
          versionId: policyVersionId,
          name: SAMPLE_POLICY_NAME,
          rules,
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: WORKSPACE_COOKIE_NAME,
      value: signedCookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: WORKSPACE_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Failed to initialize workspace:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "No active workspace session found" },
      { status: 401 }
    );
  }

  // Golden Rule 9: Query strictly scoped by workspace_id
  const [ws] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));

  if (!ws) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    workspace: {
      id: ws.id,
      aiCallsUsed: ws.aiCallsUsed,
      killSwitch: ws.killSwitch,
      createdAt: ws.createdAt,
    },
  });
}
