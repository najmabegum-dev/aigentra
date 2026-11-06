"use client";

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, RotateCw, ExternalLink, Hash } from "lucide-react";
import Link from "next/link";

export interface ChainIntegrityBadgeProps {
  workspaceId?: string;
  chainLength?: number;
  lastVerifiedAt?: string;
  isBroken?: boolean;
  brokenSeq?: number;
  className?: string;
}

export function ChainIntegrityBadge({
  workspaceId = "demo",
  chainLength = 0,
  lastVerifiedAt = new Date().toLocaleTimeString(),
  isBroken = false,
  brokenSeq,
  className = "",
}: ChainIntegrityBadgeProps) {
  const [recomputing, setRecomputing] = useState(false);
  const [status, setStatus] = useState<"OK" | "BROKEN">(isBroken ? "BROKEN" : "OK");

  async function handleReverify() {
    setRecomputing(true);
    try {
      const res = await fetch(`/api/verify/${workspaceId}`);
      if (res.ok) {
        const json = await res.json();
        setStatus(json.valid ? "OK" : "BROKEN");
      }
    } catch {
      // Fallback
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className={`p-5 rounded-card border border-border bg-surface flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Chain Integrity Badge
          </h3>
        </div>

        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/20">
          Sandbox
        </span>
      </div>

      <div className="my-4 flex items-center justify-between p-4 rounded-card border border-border/80 bg-muted/20">
        <div className="flex items-center gap-3">
          {status === "OK" ? (
            <div className="p-2.5 rounded-full bg-status-allow/15 text-status-allow border border-status-allow/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
          ) : (
            <div className="p-2.5 rounded-full bg-status-deny/15 text-status-deny border border-status-deny/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold font-mono tracking-tight ${
                  status === "OK" ? "text-status-allow" : "text-status-deny"
                }`}
              >
                CHAIN {status}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-ink border border-border">
                #{chainLength} BLOCKS
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "OK"
                ? "SHA-256 hash chain intact & gapless"
                : `Corrupted link detected at sequence #${brokenSeq || 1}`}
            </p>
          </div>
        </div>

        <button
          onClick={handleReverify}
          disabled={recomputing}
          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-ink transition-colors disabled:opacity-50"
          title="Recompute ledger hashes"
        >
          <RotateCw className={`w-4 h-4 ${recomputing ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Verified at: {lastVerifiedAt}</span>
        <Link
          href={`/verify/${workspaceId}`}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          Public Proof <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
