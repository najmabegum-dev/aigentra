import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/ui/app-shell";
import { WORKSPACE_COOKIE_NAME, verifyWorkspaceId } from "@/lib/session";
import { validateEnv } from "@/lib/env";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const rawCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const workspaceId = verifyWorkspaceId(rawCookie);

  // If visitor arrives at a workspace route without a valid signed session, redirect to landing
  if (!workspaceId) {
    redirect("/");
  }

  const { env } = validateEnv(process.env);
  const paymentMode = env?.PAYMENT_MODE ?? "dev_stub";

  return (
    <AppShell workspaceId={workspaceId} paymentMode={paymentMode}>
      {children}
    </AppShell>
  );
}
