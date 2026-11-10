import { NextRequest, NextResponse } from "next/server";
import { parseWorkspaceCookie } from "@/lib/session";
import { z } from "zod";
import { runAuditorAgent } from "@/studio/auditor/agent";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const workspaceId =
      parseWorkspaceCookie(cookieHeader) || req.headers.get("x-workspace-id");

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Missing workspace session" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { prompt, history } = parseResult.data;
    const result = await runAuditorAgent(prompt, workspaceId, history);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Auditor API handler error:", error);
    return NextResponse.json(
      { ok: false, error: "An unexpected internal server error occurred in Auditor agent." },
      { status: 500 }
    );
  }
}
