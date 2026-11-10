import { validateEnv } from "@/lib/env";
import { PersistentBanners } from "@/ui/banners";
import { ThemeToggle } from "@/ui/theme-toggle";
import { EnterWorkspaceButton } from "@/ui/enter-workspace-button";
import { HeroAttackCard } from "@/ui/hero-attack-card";
import {
  ShieldCheck,
  Bot,
  KeyRound,
  CreditCard,
  Lock,
  ArrowRight,
  Zap,
  Server,
  Fingerprint,
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
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans antialiased selection:bg-primary/20">
      {/* 32px Slim Status Bar */}
      <PersistentBanners paymentMode={paymentMode} />

      {/* Main Brand Top Header */}
      <header className="h-14 border-b border-border bg-surface/90 px-4 sm:px-8 flex items-center justify-between backdrop-blur-sm z-30 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-soft-sm">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <span className="font-sans font-extrabold tracking-wider text-foreground text-base">
            AIGENTRA
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {existingWorkspaceId && (
            <Link
              href="/policies"
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-mono"
            >
              <span className="hidden sm:inline">Resume Workspace</span>
              <span>({existingWorkspaceId.slice(0, 8)}...)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16 space-y-16 sm:space-y-24">
        {/* ===================================================================
         * Asymmetric Hero Section
         * =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Hero Column: Headline, Tagline, CTAs */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-border text-primary text-xs font-semibold shadow-soft-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Payment Mode: {paymentMode.toUpperCase()}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">PayPal Sandbox Prototype</span>
            </div>

            {/* Large Tight Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground font-sans leading-[1.08]">
              Bounded Financial Authority for AI
            </h1>

            {/* Tagline */}
            <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed max-w-xl">
              The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
            </p>

            {/* Action Buttons: Primary + Secondary */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <EnterWorkspaceButton />

              <Link
                href="/attack-lab"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-border bg-surface-raised hover:bg-muted text-foreground text-sm font-semibold transition-all duration-150 shadow-soft-sm group hover:border-primary/40"
              >
                <Zap className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Watch how it blocks an attack</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right Hero Column: Animated Hero Attack Card */}
          <div id="attack-preview" className="lg:col-span-5 flex justify-center">
            <HeroAttackCard />
          </div>
        </section>

        {/* ===================================================================
         * Bento Grid: The Four Rooms
         * =================================================================== */}
        <section className="space-y-6 text-left">
          <div className="space-y-1">
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
              Architecture & Separation of Concerns
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              The Four Rooms Architecture
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Room 1: Propose */}
            <div className="p-6 rounded-xl border border-border bg-surface shadow-soft-sm hover:border-primary/40 transition-colors duration-150 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-primary shadow-soft-sm">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                  1. Propose
                </div>
                <h3 className="text-base font-bold text-foreground">AI Agent</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Parses user intents and searches products via Channel3; model output prices are discarded and verified server-side.
                </p>
              </div>
              <div className="pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                src/rooms/propose
              </div>
            </div>

            {/* Room 2: Authorize */}
            <div className="p-6 rounded-xl border border-border bg-surface shadow-soft-sm hover:border-emerald-700/40 transition-colors duration-150 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shadow-soft-sm">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                  2. Authorize
                </div>
                <h3 className="text-base font-bold text-foreground">Deterministic Engine</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pure mathematical evaluation of spending caps, velocity windows, and kill switches; produces signed single-use Ed25519 mandates.
                </p>
              </div>
              <div className="pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                src/rooms/authorize
              </div>
            </div>

            {/* Room 3: Execute */}
            <div className="p-6 rounded-xl border border-border bg-surface shadow-soft-sm hover:border-indigo-700/40 transition-colors duration-150 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shadow-soft-sm">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                  3. Execute
                </div>
                <h3 className="text-base font-bold text-foreground">PayPal Orders v2</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Holds payment credentials and dispatches orders only when presented with a cryptographically verified mandate; zero LLM tools.
                </p>
              </div>
              <div className="pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                src/rooms/execute
              </div>
            </div>

            {/* Room 4: Verify */}
            <div className="p-6 rounded-xl border border-border bg-surface shadow-soft-sm hover:border-amber-700/40 transition-colors duration-150 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shadow-soft-sm">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                  4. Verify
                </div>
                <h3 className="text-base font-bold text-foreground">Tamper-Evident Ledger</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Validates raw-body PayPal webhooks, detects financial drift, and anchors all transitions in an append-only SHA-256 hash-chain.
                </p>
              </div>
              <div className="pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                src/rooms/verify
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
         * Honest Disclosure & System Diagnostics
         * =================================================================== */}
        <section className="p-6 sm:p-8 rounded-xl border border-border bg-surface text-left space-y-5 shadow-soft-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                System Diagnostics & Technical Baseline
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Deterministic Guard Active</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-surface-raised border border-border/70 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Storage Engine:</span>
              <span className="font-semibold text-foreground">
                {integrations.database ? "PostgreSQL Database" : "PGlite Embedded (.data/)"}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-raised border border-border/70 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Payment Boundary:</span>
              <span className="font-semibold text-foreground">
                {paymentMode === "paypal" ? "PayPal Sandbox v2" : "Dev Stub Gateway"}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-raised border border-border/70 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Session Isolation:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>HMAC-SHA256 Signed</span>
              </span>
            </div>

            <div className="p-3 rounded-lg bg-surface-raised border border-border/70 space-y-1">
              <span className="text-muted-foreground block text-[11px]">Tenant Isolation:</span>
              <span className="font-semibold text-emerald-400">
                workspace_id Scoped
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/70 text-xs text-muted-foreground leading-relaxed space-y-2">
            <div className="font-semibold text-foreground text-xs uppercase font-mono tracking-wide">
              Honest Disclosure & Regulatory Positioning
            </div>
            <p>
              • <strong>Sandbox Settlement Stand-In:</strong> This application executes against PayPal&apos;s developer sandbox with simulated test buyer accounts. No real fiat funds are moved.
            </p>
            <p>
              • <strong>AP2 Positioning:</strong> AIGENTRA is inspired by the Agent Payment Protocol (AP2) mandate architecture, but is an independent prototype and is not officially AP2-certified.
            </p>
            <p>
              • <strong>Payment Gateways:</strong> Live PayPal Sandbox API endpoints are exercised when <code className="font-mono text-foreground px-1 py-0.5 rounded bg-muted">PAYMENT_MODE=paypal</code>. A deterministic local Dev Stub Gateway simulator is provided for offline testing and property suites.
            </p>
            <p>
              • <strong>Session Boundaries:</strong> Anonymous visitor workspaces are cryptographically isolated with HMAC-SHA256 signed session cookies and mandatory database query scoping by <code className="font-mono text-foreground px-1 py-0.5 rounded bg-muted">workspace_id</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
