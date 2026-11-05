import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseWorkspaceCookie } from "@/lib/session";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Golden Rule 9: Scoped by workspace_id
  const [ws] = await db
    .select({ killSwitch: schema.workspaces.killSwitch })
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
    killSwitch: ws.killSwitch,
  });
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const workspaceId = parseWorkspaceCookie(cookieHeader);

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const killSwitch = Boolean(body?.killSwitch);

    await db
      .update(schema.workspaces)
      .set({ killSwitch })
      .where(eq(schema.workspaces.id, workspaceId));

    return NextResponse.json({
      ok: true,
      killSwitch,
    });
  } catch (error) {
    console.error("Failed to toggle kill switch:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
