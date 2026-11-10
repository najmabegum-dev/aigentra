import React from "react";
import { ShieldCheck } from "lucide-react";

interface PersistentBannersProps {
  paymentMode?: "paypal" | "dev_stub";
}

export function PersistentBanners({ paymentMode = "dev_stub" }: PersistentBannersProps) {
  return (
    <header
      role="region"
      aria-label="Sandbox Environment Status Bar"
      className="h-8 w-full border-b border-border/80 bg-surface/90 text-xs px-3 sm:px-4 flex items-center justify-between z-50 select-none backdrop-blur-sm"
    >
      {/* Left side: Environment pills */}
      <div className="flex items-center gap-2">
        {/* Sandbox Pill */}
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wider uppercase bg-purple-950/70 text-purple-300 border border-purple-800/60 shadow-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span>SANDBOX</span>
        </span>

        {/* Dev Stub Pill: Only rendered when paymentMode === "dev_stub" */}
        {paymentMode === "dev_stub" && (
          <span
            role="alert"
            aria-label="Development Stub Mode Warning"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-rose-950/80 text-rose-300 border border-rose-700/70 shadow-sm"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>DEV STUB</span>
          </span>
        )}

        {/* Clarifying label on medium+ screens */}
        <span className="hidden md:inline text-[11px] text-muted-foreground/80 pl-1">
          Settlement Stand-In Only · No Real Funds Moved
        </span>
      </div>

      {/* Right side: Security badge indicator */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="hidden sm:flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground/80">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>AUTHORITY GATEWAY</span>
        </span>
      </div>
    </header>
  );
}
