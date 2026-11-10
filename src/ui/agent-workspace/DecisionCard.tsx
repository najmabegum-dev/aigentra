"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
  Hash,
  ShieldAlert,
  ArrowRight,
  Shield,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
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
  const shouldReduceMotion = useReducedMotion();

  const handleCopyHash = () => {
    try {
      navigator.clipboard.writeText(proposalHash);
      setCopied(true);
      toast.success("Canonical Hash Copied", {
        description: `RFC 8785 SHA-256: ${proposalHash.slice(0, 16)}...`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy hash to clipboard");
    }
  };

  const getVerdictPresentation = () => {
    switch (verdict) {
      case "ALLOW":
        return {
          containerBorder: "border-emerald-500/40 dark:border-emerald-500/30",
          containerBg: "bg-emerald-950/20 dark:bg-emerald-950/15",
          glowShadow: "shadow-[0_0_24px_rgba(16,185,129,0.08)]",
          badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          verdictText: "text-emerald-600 dark:text-emerald-400",
          pillText: "AUTONOMOUS APPROVAL",
          headline: "ALLOW",
          subtitle: "All items, merchant domains, and amounts pass deterministic policy checks.",
          icon: <CheckCircle2 className="h-7 w-7 text-emerald-500 dark:text-emerald-400 shrink-0" />,
        };
      case "REQUIRE_APPROVAL":
        return {
          containerBorder: "border-amber-500/40 dark:border-amber-500/30",
          containerBg: "bg-amber-950/20 dark:bg-amber-950/15",
          glowShadow: "shadow-[0_0_24px_rgba(245,158,11,0.08)]",
          badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          verdictText: "text-amber-600 dark:text-amber-400",
          pillText: "PAYER CONSENT REQUIRED",
          headline: "REQUIRE_APPROVAL",
          subtitle: "Threshold or merchant approval rule triggered. Payer confirmation needed.",
          icon: <AlertTriangle className="h-7 w-7 text-amber-500 dark:text-amber-400 shrink-0" />,
        };
      case "DENY":
      default:
        return {
          containerBorder: "border-rose-500/40 dark:border-rose-500/30",
          containerBg: "bg-rose-950/20 dark:bg-rose-950/15",
          glowShadow: "shadow-[0_0_24px_rgba(244,63,94,0.08)]",
          badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          verdictText: "text-rose-600 dark:text-rose-400",
          pillText: "POLICY BLOCKED",
          headline: "DENY",
          subtitle: "Transaction rejected. Exceeds cart/daily spend caps or violates safety rules.",
          icon: <XCircle className="h-7 w-7 text-rose-500 dark:text-rose-400 shrink-0" />,
        };
    }
  };

  const style = getVerdictPresentation();

  // Animation variants for staggered rule results
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const listItemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
  };

  return (
    <div
      className={`rounded-xl border backdrop-blur-xs p-6 transition-all duration-200 ${style.containerBorder} ${style.containerBg} ${style.glowShadow}`}
    >
      {/* Top Bar: Large Verdict + Amount in Large Tabular Numerals */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-200/50 dark:border-zinc-800/60">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0B1324] border border-zinc-200 dark:border-zinc-800 shadow-xs">
            {style.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider border ${style.badgeBg}`}
              >
                {style.pillText}
              </span>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                AIGENTRA ENGINE v1.0
              </span>
            </div>
            {/* Very Large Verdict */}
            <h2
              className={`text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight mt-1 leading-none ${style.verdictText}`}
            >
              {style.headline}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-xl">
              {style.subtitle}
            </p>
          </div>
        </div>

        {/* Recomputed Amount in Large Tabular Numerals */}
        {totalCents !== undefined && (
          <div className="sm:text-right shrink-0 bg-white/70 dark:bg-[#0B1324]/80 p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Recomputed Total
            </div>
            <div className="flex items-baseline sm:justify-end gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                ${formatMoney(totalCents)}
              </span>
              <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                USD
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
              Verified Server-Side
            </div>
          </div>
        )}
      </div>

      {/* Reason Codes Chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono font-semibold uppercase text-zinc-500 dark:text-zinc-400 mr-1">
          Reason Codes:
        </span>
        {reasonCodes.length === 0 ? (
          <span className="text-xs font-mono text-zinc-500">None</span>
        ) : (
          reasonCodes.map((code) => {
            const isDeny =
              code.includes("DENY") ||
              code.includes("OVER") ||
              code.includes("EXCEEDED") ||
              code.includes("MISMATCH") ||
              code.includes("BLOCKED");
            const isApproval = code.includes("APPROVAL") || code.includes("THRESHOLD");

            const chipColor = isDeny
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : isApproval
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

            return (
              <span
                key={code}
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold border tracking-wide transition-colors ${chipColor}`}
              >
                {code}
              </span>
            );
          })
        )}
      </div>

      {/* Proposal Canonical Hash Chip (RFC 8785) with copy and toast */}
      <div className="mt-4 p-3 rounded-lg bg-zinc-100 dark:bg-[#060B14] border border-zinc-200 dark:border-zinc-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <Hash className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-zinc-500 dark:text-zinc-400 shrink-0 font-semibold select-none">
            RFC 8785 SHA-256:
          </span>
          <span
            className="truncate text-zinc-800 dark:text-zinc-200 select-all font-mono"
            title={proposalHash}
          >
            {proposalHash}
          </span>
        </div>
        <button
          onClick={handleCopyHash}
          type="button"
          aria-label="Copy canonical proposal hash"
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors text-[11px] font-semibold shrink-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copied ? "Copied" : "Copy Hash"}</span>
        </button>
      </div>

      {/* Rules Checklist Animated in with a Stagger */}
      <div className="mt-5 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/60">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            Deterministic Rules Checklist ({ruleResults.length})
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">
            Evaluated: {new Date(evaluatedAt).toLocaleTimeString()}
          </span>
        </div>

        <motion.div
          variants={listContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1.5 max-h-56 overflow-y-auto pr-1"
        >
          {ruleResults.map((r, i) => (
            <motion.div
              key={`${r.rule}-${i}`}
              variants={listItemVariants}
              className={`flex items-start sm:items-center justify-between gap-2 text-xs py-2 px-3 rounded-lg border transition-colors ${
                r.passed
                  ? "bg-white/80 dark:bg-[#0B1324]/80 border-zinc-200/70 dark:border-zinc-800/70"
                  : "bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {r.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {r.rule}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      r.decision === "ALLOW"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : r.decision === "REQUIRE_APPROVAL"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {r.decision}
                  </span>
                </div>
              </div>
              <span
                className="text-[11px] text-zinc-500 dark:text-zinc-400 text-right shrink-0 max-w-[280px] truncate"
                title={r.message}
              >
                {r.message}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Next Step / Action Bar */}
      {verdict !== "DENY" && (
        <div className="mt-5 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-end gap-3">
          {verdict === "REQUIRE_APPROVAL" && (
            <a
              href="/approvals"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Open Approval Centre</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </a>
          )}
          {verdict === "ALLOW" && (
            <button
              onClick={onProceed}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Proceed to PayPal Checkout</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
