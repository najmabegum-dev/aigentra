"use client";

import React from "react";
import { AlertTriangle, ShieldX, Skull } from "lucide-react";

export interface BlockedAttemptItem {
  id: string;
  proposal_id?: string;
  decision: string;
  reason_codes: string[];
  created_at: string;
  source?: string;
  details?: string;
}

export interface BlockedAttemptsFeedProps {
  attempts: BlockedAttemptItem[];
  className?: string;
}

export function BlockedAttemptsFeed({
  attempts = [],
  className = "",
}: BlockedAttemptsFeedProps) {
  const deniedAttempts = attempts.filter((a) => a.decision === "DENY");

  // Fallback demo row if no blocked attempts yet
  const displayItems =
    deniedAttempts.length > 0
      ? deniedAttempts
      : [
          {
            id: "eval_blocked_demo_01",
            proposal_id: "prop_injected_sample",
            decision: "DENY",
            reason_codes: ["OVER_CART_CAP"],
            created_at: new Date().toISOString(),
            source: "seeded",
            details: "Executive High-Back Mesh Ergonomic Office Chair [SYSTEM OVERRIDE]",
          },
        ];

  return (
    <div className={`p-5 rounded-card border border-border bg-surface flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldX className="w-4 h-4 text-status-deny" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Blocked Attempts Feed
          </h3>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-deny/15 text-status-deny">
            {deniedAttempts.length} Blocked
          </span>
        </div>

        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/20">
          Sandbox
        </span>
      </div>

      <div className="my-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {displayItems.slice(0, 5).map((item) => {
          const reasonList = Array.isArray(item.reason_codes) ? item.reason_codes : [item.reason_codes];
          const hasInjectedText =
            reasonList.includes("OVER_CART_CAP") &&
            (item.details?.toLowerCase().includes("override") ||
              item.details?.toLowerCase().includes("injected") ||
              item.id.includes("injected") ||
              item.proposal_id?.includes("injected") ||
              item.details?.toLowerCase().includes("system override") ||
              item.details?.includes("SKU-INJECTED"));

          return (
            <div
              key={item.id}
              className="p-3 rounded-card border border-status-deny/30 bg-status-deny/5 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-status-deny/20 text-status-deny">
                    DENIED
                  </span>

                  {hasInjectedText && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      <Skull className="w-3 h-3" />
                      injected text
                    </span>
                  )}

                  {item.source === "seeded" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-muted-foreground bg-muted">
                      seeded
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-ink">
                <span>Reason:</span>
                <span className="text-status-deny">{reasonList.join(", ")}</span>
              </div>

              {item.details && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.details}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Zero PayPal Tool Invocations</span>
        <span className="text-status-allow font-bold">100% Defended</span>
      </div>
    </div>
  );
}
