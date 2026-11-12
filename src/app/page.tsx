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
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans antialiased selection:bg-signal/20">
      {/* 32px Slim Status Bar */}
      <PersistentBanners paymentMode={paymentMode} />

      {/* Main Brand Top Header */}
      <header className="h-14 border-b border-line bg-surface px-4 sm:px-8 flex items-center justify-between z-30 select-none">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-signal" strokeWidth={1.25} />
          <span className="font-sans font-bold tracking-wider text-text text-base">
            AIGENTRA
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {existingWorkspaceId && (
            <Link
              href="/policies"
              className="text-xs font-mono font-medium text-text-dim hover:text-text transition-colors flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Resume Workspace</span>
              <span>({existingWorkspaceId.slice(0, 8)}...)</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.25} />
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
            {/* Meta tag (Rectangular, not a pill) */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-surface-2 border border-line text-text-dim text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-signal" />
              <span className="font-bold text-text">Payment Mode: {paymentMode.toUpperCase()}</span>
              <span>•</span>
              <span>PayPal Sandbox Prototype</span>
            </div>

            {/* Large Tight Headline in Instrument Serif */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-normal tracking-tight text-text leading-[1.08]">
              Bounded Financial Authority for AI
            </h1>

            {/* Tagline */}
            <p className="text-base sm:text-lg text-text-dim font-sans leading-relaxed max-w-xl">
              The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
            </p>

            {/* Action Buttons: Primary + Secondary */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <EnterWorkspaceButton />

              <Link
                href="/attack-lab"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[4px] border border-line bg-surface-2 hover:bg-surface text-text text-xs font-mono font-medium transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4 text-deny" strokeWidth={1.25} />
                <span>Watch how it blocks an attack</span>
                <ArrowRight className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.25} />
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
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-text-dim">
              Architecture &amp; Separation of Concerns
            </div>
            <h2 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-text">
              The Four Rooms Architecture
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Room 1: Propose */}
            <div className="p-5 rounded-[6px] border border-line bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <Bot className="w-5 h-5 text-signal" strokeWidth={1.25} />
                <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider font-bold">
                  1. Propose
                </div>
                <h3 className="text-base font-bold text-text">AI Agent</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Parses user intents and searches products via Channel3; model output prices are discarded and verified server-side.
                </p>
              </div>
              <div className="pt-2 border-t border-line text-[11px] font-mono text-text-dim">
                src/rooms/propose
              </div>
            </div>

            {/* Room 2: Authorize */}
            <div className="p-5 rounded-[6px] border border-line bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <KeyRound className="w-5 h-5 text-allow" strokeWidth={1.25} />
                <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider font-bold">
                  2. Authorize
                </div>
                <h3 className="text-base font-bold text-text">Deterministic Engine</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Pure mathematical evaluation of spending caps, velocity windows, and kill switches; produces signed single-use Ed25519 mandates.
                </p>
              </div>
              <div className="pt-2 border-t border-line text-[11px] font-mono text-text-dim">
                src/rooms/authorize
              </div>
            </div>

            {/* Room 3: Execute */}
            <div className="p-5 rounded-[6px] border border-line bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <CreditCard className="w-5 h-5 text-approval" strokeWidth={1.25} />
                <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider font-bold">
                  3. Execute
                </div>
                <h3 className="text-base font-bold text-text">PayPal Orders v2</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Holds payment credentials and dispatches orders only when presented with a cryptographically verified mandate; zero LLM tools.
                </p>
              </div>
              <div className="pt-2 border-t border-line text-[11px] font-mono text-text-dim">
                src/rooms/execute
              </div>
            </div>

            {/* Room 4: Verify */}
            <div className="p-5 rounded-[6px] border border-line bg-surface space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <Lock className="w-5 h-5 text-signal" strokeWidth={1.25} />
                <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider font-bold">
                  4. Verify
                </div>
                <h3 className="text-base font-bold text-text">Tamper-Evident Ledger</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Validates raw-body PayPal webhooks, detects financial drift, and anchors all transitions in an append-only SHA-256 hash-chain.
                </p>
              </div>
              <div className="pt-2 border-t border-line text-[11px] font-mono text-text-dim">
                src/rooms/verify
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
         * Honest Disclosure & System Diagnostics
         * =================================================================== */}
        <section className="p-6 sm:p-7 rounded-[6px] border border-line bg-surface text-left space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-signal" strokeWidth={1.25} />
              <h3 className="text-sm font-bold text-text">
                System Diagnostics &amp; Technical Baseline
              </h3>
            </div>
            {/* Real Status: rounded-full pill */}
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-allow/10 text-allow border border-allow/30 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-allow" />
              <span>Deterministic Guard Active</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-[4px] bg-surface-2 border border-line space-y-1">
              <span className="text-text-dim block text-[10px] uppercase">Storage Engine:</span>
              <span className="font-bold text-text">
                {integrations.database ? "PostgreSQL Database" : "PGlite Embedded (.data/)"}
              </span>
            </div>

            <div className="p-3 rounded-[4px] bg-surface-2 border border-line space-y-1">
              <span className="text-text-dim block text-[10px] uppercase">Payment Boundary:</span>
              <span className="font-bold text-text">
                {paymentMode === "paypal" ? "PayPal Sandbox v2" : "Dev Stub Gateway"}
              </span>
            </div>

            <div className="p-3 rounded-[4px] bg-surface-2 border border-line space-y-1">
              <span className="text-text-dim block text-[10px] uppercase">Session Isolation:</span>
              <span className="font-bold text-allow flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5" strokeWidth={1.25} />
                <span>HMAC-SHA256 Signed</span>
              </span>
            </div>

            <div className="p-3 rounded-[4px] bg-surface-2 border border-line space-y-1">
              <span className="text-text-dim block text-[10px] uppercase">Tenant Isolation:</span>
              <span className="font-bold text-allow">
                workspace_id Scoped
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-line text-xs text-text-dim leading-relaxed space-y-2">
            <div className="font-bold text-text text-xs uppercase font-mono tracking-wide">
              Honest Disclosure &amp; Regulatory Positioning
            </div>
            <p>
              • <strong>Sandbox Settlement Stand-In:</strong> This application executes against PayPal&apos;s developer sandbox with simulated test buyer accounts. No real fiat funds are moved.
            </p>
            <p>
              • <strong>AP2 Positioning:</strong> AIGENTRA is inspired by the Agent Payment Protocol (AP2) mandate architecture, but is an independent prototype and is not officially AP2-certified.
            </p>
            <p>
              • <strong>Payment Gateways:</strong> Live PayPal Sandbox API endpoints are exercised when <code className="font-mono text-text px-1 py-0.5 rounded-[4px] bg-surface-2">PAYMENT_MODE=paypal</code>. A deterministic local Dev Stub Gateway simulator is provided for offline testing and property suites.
            </p>
            <p>
              • <strong>Session Boundaries:</strong> Anonymous visitor workspaces are cryptographically isolated with HMAC-SHA256 signed session cookies and mandatory database query scoping by <code className="font-mono text-text px-1 py-0.5 rounded-[4px] bg-surface-2">workspace_id</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
