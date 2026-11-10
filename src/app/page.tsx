import { validateEnv } from "@/lib/env";
import { PersistentBanners } from "@/ui/banners";
import { ThemeToggle } from "@/ui/theme-toggle";
import { EnterWorkspaceButton } from "@/ui/enter-workspace-button";
import {
  ShieldCheck,
  Bot,
  KeyRound,
  CreditCard,
  Lock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { WORKSPACE_COOKIE_NAME, verifyWorkspaceId } from "@/lib/session";

export default function HomePage() {
  const { env, integrations } = validateEnv(process.env);
  const paymentMode =
    env?.PAYMENT_MODE ??
    (process.env.PAYMENT_MODE === "paypal" ? "paypal" : "dev_stub");

  const cookieStore = cookies();
  const rawCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const existingWorkspaceId = verifyWorkspaceId(rawCookie);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Persistent Top Banners */}
      <PersistentBanners paymentMode={paymentMode} />

      {/* Landing Header */}
      <header className="h-16 border-b border-border bg-surface px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <span className="font-sans font-extrabold tracking-wider text-ink text-lg">
            AIGENTRA
          </span>
        </div>

        <div className="flex items-center gap-4">
          {existingWorkspaceId && (
            <Link
              href="/policies"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Resume Workspace ({existingWorkspaceId.slice(0, 8)}...)
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 max-w-5xl mx-auto w-full text-center space-y-12">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-primary text-xs font-semibold">
            <span>Payment Mode: {paymentMode.toUpperCase()}</span>
            <span>•</span>
            <span>Hackathon Sandbox Prototype</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-ink font-sans">
            Bounded Financial Authority for AI
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <EnterWorkspaceButton />
            {existingWorkspaceId && (
              <Link
                href="/policies"
                className="px-5 py-3 rounded-input border border-border bg-surface hover:bg-muted text-ink text-sm font-semibold transition-colors duration-standard"
              >
                Go to Active Workspace
              </Link>
            )}
          </div>
        </div>

        {/* The Four Rooms Explainer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="p-5 rounded-card border border-border bg-surface space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-primary">
              <Bot className="w-4 h-4" />
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
              1. Propose
            </div>
            <h2 className="text-sm font-bold text-ink">AI Agent</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Finds real products, parses user intents, and creates carts. Totals are recomputed on the server; the model never decides.
            </p>
          </div>

          <div className="p-5 rounded-card border border-border bg-surface space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-status-allow">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
              2. Authorize
            </div>
            <h2 className="text-sm font-bold text-ink">Deterministic Engine</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Evaluates guardrails (per-item caps, daily caps, velocity windows). Yields an EdDSA-signed, single-use mandate.
            </p>
          </div>

          <div className="p-5 rounded-card border border-border bg-surface space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
              3. Execute
            </div>
            <h2 className="text-sm font-bold text-ink">PayPal Orders v2</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Only accepts a cryptographically verified mandate. Dispatches orders and requests buyer authorization.
            </p>
          </div>

          <div className="p-5 rounded-card border border-border bg-surface space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-status-approval">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
              4. Verify
            </div>
            <h2 className="text-sm font-bold text-ink">Tamper-Evident Ledger</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Raw-body verified webhooks confirm funds and seal an append-only, SHA-256 hash-chained event ledger.
            </p>
          </div>
        </div>

        {/* Integration Status & Honest Limitations */}
        <div className="max-w-2xl w-full p-6 rounded-card border border-border bg-surface text-left space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-ink">System Status & Environment</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-status-allow border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
              Deterministic Guard Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Storage:</span>
              <span className="font-semibold text-ink font-mono">
                {integrations.database ? "Postgres Database" : "PGlite Embedded (.data/)"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Payment Boundary:</span>
              <span className="font-semibold text-ink font-mono">
                {paymentMode === "paypal" ? "PayPal Sandbox v2" : "Dev Stub Gateway"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Session Security:</span>
              <span className="font-semibold text-status-allow font-mono">
                HMAC-SHA256 Signed HttpOnly
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Tenant Isolation:</span>
              <span className="font-semibold text-status-allow font-mono">
                Mandatory workspace_id Scoping
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
            <strong>Honest Disclosure:</strong> This application runs in PayPal Sandbox mode with synthetic test funds. We are AP2-inspired, not AP2-compliant. Anonymous visitor workspaces are cryptographically isolated with signed session cookies and mandatory workspace-scoped data boundaries.
          </div>
        </div>
      </main>
    </div>
  );
}
