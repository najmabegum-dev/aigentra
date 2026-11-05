import { Settings } from "lucide-react";
import { validateEnv } from "@/lib/env";

export default function SettingsPage() {
  const { integrations, env } = validateEnv(process.env);
  const paymentMode = env?.PAYMENT_MODE ?? "dev_stub";

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <Settings className="w-6 h-6 text-muted-foreground" />
          Settings & Health
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workspace configuration, integration health, and emergency controls.
        </p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        <div className="rounded-card border border-border bg-surface p-6 space-y-4">
          <h2 className="text-base font-bold text-ink">Active Integrations</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">Payment Engine</span>
              <span className="font-semibold text-ink font-mono">{paymentMode.toUpperCase()}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">Database Storage</span>
              <span className="font-semibold text-status-allow font-mono">
                {integrations.database ? "Postgres (URL)" : "PGlite Embedded (.data/)"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">PayPal Sandbox</span>
              <span className="font-semibold font-mono">
                {integrations.paypal ? "Configured" : "Unconfigured (Dev Stub)"}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Gemini AI</span>
              <span className="font-semibold font-mono">
                {integrations.gemini ? "Live API" : "Replay Mode"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
