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
      className="h-8 w-full border-b border-line bg-surface text-xs px-3 sm:px-4 flex items-center justify-between z-50 select-none"
    >
      {/* Left side: Environment pills (real status) */}
      <div className="flex items-center gap-2">
        {/* Sandbox Pill */}
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-approval/10 text-approval border border-approval/30">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-approval animate-pulse" />
          <span>SANDBOX</span>
        </span>

        {/* Dev Stub Pill: Only rendered when paymentMode === "dev_stub" */}
        {paymentMode === "dev_stub" && (
          <span
            role="alert"
            aria-label="Development Stub Mode Warning"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-deny/10 text-deny border border-deny/30"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-deny" />
            <span>DEV STUB</span>
          </span>
        )}

        {/* Clarifying label on medium+ screens */}
        <span className="hidden md:inline text-[11px] font-mono text-text-dim pl-1">
          Settlement Stand-In Only · No Real Funds Moved
        </span>
      </div>

      {/* Right side: Security badge indicator */}
      <div className="flex items-center gap-2 text-[11px] font-mono text-text-dim">
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-text-dim">
          <ShieldCheck className="w-3.5 h-3.5 text-allow" strokeWidth={1.25} />
          <span>AUTHORITY GATEWAY</span>
        </span>
      </div>
    </header>
  );
}
