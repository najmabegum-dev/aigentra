"use client";

import { useState } from "react";
import { Eye, Code, FileText, CheckCircle2 } from "lucide-react";
import type { PolicyRuleDefinition } from "@/rooms/authorize/types";
import { centsToPayPalString } from "@/lib/money";
import { generatePlainLanguageSummary } from "@/lib/policies";

interface LivePreviewProps {
  rules: PolicyRuleDefinition;
  isHistorical?: boolean;
  versionNumber?: number;
}

export function LivePreview({
  rules,
  isHistorical = false,
  versionNumber,
}: LivePreviewProps) {
  const [showJson, setShowJson] = useState(false);
  const plainSummary = generatePlainLanguageSummary(rules);

  return (
    <div className="space-y-4">
      {/* Plain Language Summary Box */}
      <div className="rounded-card border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span>Plain-Language Enforcement Summary</span>
          </div>
          {isHistorical && versionNumber && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Inspecting Historical v{versionNumber}
            </span>
          )}
        </div>

        <p className="text-xs text-ink leading-relaxed font-sans bg-muted/40 p-3 rounded-input border border-border/60">
          {plainSummary}
        </p>
      </div>

      {/* Live Structured Preview Box */}
      <div className="rounded-card border border-border bg-surface p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Eye className="w-4 h-4 text-status-allow" />
            <span>Structured Guardrails Preview</span>
          </div>

          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="text-xs font-mono px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground flex items-center gap-1.5 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showJson ? "Hide JSON" : "Show JSON"}</span>
          </button>
        </div>

        {/* 4 Core Limits Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-input bg-surface-raised border border-border">
            <span className="text-[11px] text-muted-foreground block font-medium">Cart Maximum</span>
            <span className="text-lg font-bold text-ink font-mono">
              ${centsToPayPalString(rules.cart_max_cents)}
            </span>
            <span className="text-[10px] text-status-deny block">Hard DENY if above</span>
          </div>

          <div className="p-3 rounded-input bg-surface-raised border border-border">
            <span className="text-[11px] text-muted-foreground block font-medium">Approval Threshold</span>
            <span className="text-lg font-bold text-status-approval font-mono">
              ${centsToPayPalString(rules.approval_threshold_cents)}
            </span>
            <span className="text-[10px] text-status-approval block">Require human sign-off</span>
          </div>

          <div className="p-3 rounded-input bg-surface-raised border border-border">
            <span className="text-[11px] text-muted-foreground block font-medium">Per-Item Limit</span>
            <span className="text-lg font-bold text-ink font-mono">
              ${centsToPayPalString(rules.per_item_max_cents)}
            </span>
            <span className="text-[10px] text-muted-foreground block">Max single line price</span>
          </div>

          <div className="p-3 rounded-input bg-surface-raised border border-border">
            <span className="text-[11px] text-muted-foreground block font-medium">Daily Spend Cap</span>
            <span className="text-lg font-bold text-ink font-mono">
              ${centsToPayPalString(rules.daily_cap_cents)}
            </span>
            <span className="text-[10px] text-muted-foreground block">Calendar day limit</span>
          </div>
        </div>

        {/* Extra Rule Chips */}
        <div className="space-y-3 pt-2 text-xs">
          <div>
            <span className="font-semibold text-ink block mb-1">Merchant Boundary:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {rules.merchant_mode}
              </span>
              {rules.merchants && rules.merchants.length > 0 ? (
                rules.merchants.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-[11px]"
                  >
                    {m}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-[11px]">No specific domains listed</span>
              )}
            </div>
          </div>

          <div>
            <span className="font-semibold text-ink block mb-1">Blocked Categories:</span>
            <div className="flex flex-wrap gap-1">
              {rules.blocked_categories && rules.blocked_categories.length > 0 ? (
                rules.blocked_categories.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900 font-mono text-[11px]"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-[11px]">None blocked</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border">
            <div>
              <span className="font-medium text-ink">Velocity Window: </span>
              <span className="font-mono">{rules.velocity_minutes} min</span>
            </div>
            <div>
              <span className="font-medium text-ink">Price Freshness: </span>
              <span className="font-mono">{rules.price_max_age_seconds}s</span>
            </div>
          </div>
        </div>

        {/* Collapsible JSON Preview */}
        {showJson && (
          <pre className="p-3 rounded-input bg-muted/80 text-[11px] font-mono text-ink overflow-x-auto border border-border">
            {JSON.stringify(rules, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
