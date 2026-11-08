"use client";

import { useEffect, useState } from "react";
import { Settings, RefreshCw, CheckCircle2, AlertCircle, Database, Shield, Cpu, ShoppingBag, Eye } from "lucide-react";

interface HealthData {
  status: string;
  paymentMode: string;
  integrations: {
    database: boolean;
    paypal: boolean;
    gemini: boolean;
    channel3: boolean;
    agStudio: boolean;
  };
  geminiModel?: {
    id: string;
    operational: boolean;
    error?: string;
  };
  missingIntegrations: string[];
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load health status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Settings className="w-6 h-6 text-muted-foreground" />
            Settings & System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time diagnostics from <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">/api/health</code>, runtime configuration, and integration checks.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-input border border-border bg-surface hover:bg-muted text-ink transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Health</span>
        </button>
      </div>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading /api/health: {error}</span>
        </div>
      )}

      <div className="grid gap-6 max-w-3xl">
        {/* Overall Status Banner */}
        <div className="rounded-card border border-border bg-surface p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${health?.status === "ok" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <div>
              <div className="text-sm font-semibold text-ink">System Status</div>
              <div className="text-xs text-muted-foreground">API routes & execution runtime operational</div>
            </div>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold uppercase">
            {health?.status || (loading ? "Checking..." : "Offline")}
          </span>
        </div>

        {/* Integration Status Table */}
        <div className="rounded-card border border-border bg-surface p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-ink">Integration Diagnostics (/api/health)</h2>
          <div className="divide-y divide-border text-sm">
            {/* Database */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">Database Storage</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {health?.integrations?.database ? "Postgres / PGlite (Active)" : "Embedded PGlite (Active)"}
              </span>
            </div>

            {/* Payment Engine */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">Payment Mode</span>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-ink">
                {health?.paymentMode?.toUpperCase() || "DEV_STUB"}
              </span>
            </div>

            {/* PayPal */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">PayPal Sandbox</span>
              </div>
              <span className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                health?.integrations?.paypal
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                {health?.integrations?.paypal ? "Configured (Live Sandbox)" : "Dev Stub Gateway (Active)"}
              </span>
            </div>

            {/* Gemini */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">Gemini AI</span>
              </div>
              <div className="flex items-center gap-2">
                {health?.geminiModel && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {health.geminiModel.id}
                  </span>
                )}
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                  health?.integrations?.gemini
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {health?.integrations?.gemini ? "Live Gemini Flash" : "Deterministic Replay"}
                </span>
              </div>
            </div>

            {/* Channel3 */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">Product Search (Channel3)</span>
              </div>
              <span className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                health?.integrations?.channel3
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                {health?.integrations?.channel3 ? "Live API" : "Seeded Catalogue"}
              </span>
            </div>

            {/* AG Studio */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-ink">AG Studio Telemetry</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded font-medium bg-muted text-ink">
                {health?.integrations?.agStudio ? "Licensed" : "Evaluation (Watermark)"}
              </span>
            </div>
          </div>
        </div>

        {/* Raw Response Details */}
        <div className="rounded-card border border-border bg-surface p-5 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Raw Health Payload
          </h3>
          <pre className="text-xs font-mono bg-muted/60 p-3 rounded-input overflow-x-auto text-ink border border-border">
            {health ? JSON.stringify(health, null, 2) : "Loading payload..."}
          </pre>
        </div>
      </div>
    </div>
  );
}
