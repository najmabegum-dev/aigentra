"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Copy, Check, ShieldCheck, Hash } from "lucide-react";
import { formatMoney } from "@/lib/money";

export interface DecisionCardProps {
  verdict: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  reasonCodes: string[];
  ruleResults: Array<{
    rule: string;
    passed: boolean;
    decision: string;
    message: string;
  }>;
  proposalHash: string;
  evaluatedAt: string;
  proposalId?: string;
  totalCents?: number;
  onProceed?: () => void;
}

export function DecisionCard({
  verdict,
  reasonCodes,
  ruleResults,
  proposalHash,
  evaluatedAt,
  proposalId,
  totalCents,
  onProceed,
}: DecisionCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(proposalHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = () => {
    switch (verdict) {
      case "ALLOW":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
          text: "text-emerald-700 dark:text-emerald-400",
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
          title: "ALLOW — Auto-Authorized",
          subtitle: "All cart items and amounts are within active policy guardrails.",
        };
      case "REQUIRE_APPROVAL":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
          text: "text-amber-700 dark:text-amber-400",
          icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          title: "REQUIRE_APPROVAL — Payer Consent Needed",
          subtitle: "Proposal exceeds approval threshold or requires merchant sign-off.",
        };
      case "DENY":
      default:
        return {
          bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
          text: "text-rose-700 dark:text-rose-400",
          icon: <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
          title: "DENY — Policy Violation",
          subtitle: "Cart violated spending ceilings, denylists, or data integrity rules.",
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <div className={`rounded-xl border p-6 shadow-sm transition-all ${style.bg}`}>
      {/* Verdict Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 shadow-xs border border-zinc-200/50 dark:border-zinc-800/50">
            {style.icon}
          </div>
          <div>
            <h3 className={`text-lg font-bold tracking-tight ${style.text}`}>{style.title}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{style.subtitle}</p>
          </div>
        </div>
        {totalCents !== undefined && (
          <div className="text-right">
            <span className="text-xs text-zinc-500 font-medium">Recomputed Total</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              ${formatMoney(totalCents)} USD
            </div>
          </div>
        )}
      </div>

      {/* Reason Codes Pills */}
      <div className="mt-4 flex flex-wrap gap-1.5 items-center">
        <span className="text-xs font-semibold text-zinc-500 mr-1">Reason Codes:</span>
        {reasonCodes.map((code) => (
          <span
            key={code}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-white/90 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            {code}
          </span>
        ))}
      </div>

      {/* Proposal Canonical Hash Chip (RFC 8785) */}
      <div className="mt-4 p-3 rounded-lg bg-zinc-900 dark:bg-black text-zinc-300 font-mono text-xs flex items-center justify-between border border-zinc-800">
        <div className="flex items-center gap-2 overflow-hidden">
          <Hash className="h-4 w-4 text-primary shrink-0" />
          <span className="text-zinc-500 select-none">SHA-256:</span>
          <span className="truncate text-zinc-200" title={proposalHash}>
            {proposalHash}
          </span>
        </div>
        <button
          onClick={handleCopyHash}
          className="ml-3 inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px]"
          title="Copy Canonical Hash"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Rule Pass/Fail Breakdown Table */}
      <div className="mt-5 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Rule Evaluation Breakdown
        </h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {ruleResults.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {r.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                )}
                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                  {r.rule}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 truncate max-w-[200px]" title={r.message}>
                {r.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Step / Action */}
      {verdict !== "DENY" && (
        <div className="mt-5 pt-3 flex justify-end gap-3">
          {verdict === "REQUIRE_APPROVAL" && (
            <a
              href="/approvals"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Open Approval Centre
            </a>
          )}
          {verdict === "ALLOW" && (
            <button
              onClick={onProceed}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Proceed to PayPal Checkout
            </button>
          )}
        </div>
      )}
    </div>
  );
}
