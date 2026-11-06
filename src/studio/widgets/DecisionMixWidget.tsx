"use client";

import React from "react";
import { PieChart, Filter } from "lucide-react";

export interface DecisionRecord {
  id: string;
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  reason_codes?: string[];
  created_at: string;
}

export interface DecisionMixWidgetProps {
  decisions: DecisionRecord[];
  selectedFilter?: string | null;
  onSelectFilter?: (decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY" | null) => void;
  className?: string;
}

export function DecisionMixWidget({
  decisions = [],
  selectedFilter = null,
  onSelectFilter,
  className = "",
}: DecisionMixWidgetProps) {
  const total = Math.max(decisions.length, 1);

  const allowCount = decisions.filter((d) => d.decision === "ALLOW").length;
  const approvalCount = decisions.filter((d) => d.decision === "REQUIRE_APPROVAL").length;
  const denyCount = decisions.filter((d) => d.decision === "DENY").length;

  const allowPct = Math.round((allowCount / total) * 100);
  const approvalPct = Math.round((approvalCount / total) * 100);
  const denyPct = Math.round((denyCount / total) * 100);

  return (
    <div className={`p-5 rounded-card border border-border bg-surface flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Decision Mix
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/20">
          Sandbox
        </span>
      </div>

      <div className="my-3 space-y-3">
        {/* Progress bar split */}
        <div className="w-full h-3 rounded-full bg-muted flex overflow-hidden">
          <div
            style={{ width: `${allowPct}%` }}
            className="bg-status-allow transition-all duration-300"
            title={`ALLOW: ${allowCount} (${allowPct}%)`}
          />
          <div
            style={{ width: `${approvalPct}%` }}
            className="bg-status-approval transition-all duration-300"
            title={`APPROVAL: ${approvalCount} (${approvalPct}%)`}
          />
          <div
            style={{ width: `${denyPct}%` }}
            className="bg-status-deny transition-all duration-300"
            title={`DENY: ${denyCount} (${denyPct}%)`}
          />
        </div>

        {/* Clickable Mix Cards for Cross-Filtering */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onSelectFilter?.(selectedFilter === "ALLOW" ? null : "ALLOW")}
            className={`p-2.5 rounded-card border text-left transition-all ${
              selectedFilter === "ALLOW"
                ? "border-status-allow bg-status-allow/10 shadow-sm"
                : "border-border/70 hover:bg-muted/40"
            }`}
          >
            <p className="text-[11px] font-bold text-status-allow">ALLOW</p>
            <p className="text-lg font-bold text-ink mt-0.5">{allowCount}</p>
            <p className="text-[10px] text-muted-foreground">{allowPct}%</p>
          </button>

          <button
            onClick={() => onSelectFilter?.(selectedFilter === "REQUIRE_APPROVAL" ? null : "REQUIRE_APPROVAL")}
            className={`p-2.5 rounded-card border text-left transition-all ${
              selectedFilter === "REQUIRE_APPROVAL"
                ? "border-status-approval bg-status-approval/10 shadow-sm"
                : "border-border/70 hover:bg-muted/40"
            }`}
          >
            <p className="text-[11px] font-bold text-status-approval">APPROVAL</p>
            <p className="text-lg font-bold text-ink mt-0.5">{approvalCount}</p>
            <p className="text-[10px] text-muted-foreground">{approvalPct}%</p>
          </button>

          <button
            onClick={() => onSelectFilter?.(selectedFilter === "DENY" ? null : "DENY")}
            className={`p-2.5 rounded-card border text-left transition-all ${
              selectedFilter === "DENY"
                ? "border-status-deny bg-status-deny/10 shadow-sm"
                : "border-border/70 hover:bg-muted/40"
            }`}
          >
            <p className="text-[11px] font-bold text-status-deny">DENY</p>
            <p className="text-lg font-bold text-ink mt-0.5">{denyCount}</p>
            <p className="text-[10px] text-muted-foreground">{denyPct}%</p>
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Evaluations:</span>
        <span className="font-mono font-bold text-ink">{decisions.length} Total</span>
      </div>
    </div>
  );
}
