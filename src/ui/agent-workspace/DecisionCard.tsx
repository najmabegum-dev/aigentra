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
          containerBorder: "border-allow/40",
          containerBg: "bg-surface",
          badgeBg: "bg-allow/10 text-allow border-allow/30",
          verdictText: "text-allow",
          pillText: "AUTONOMOUS APPROVAL",
          headline: "ALLOW",
          subtitle: "All items, merchant domains, and amounts pass deterministic policy checks.",
          icon: <CheckCircle2 className="h-7 w-7 text-allow shrink-0" strokeWidth={1.25} />,
        };
      case "REQUIRE_APPROVAL":
        return {
          containerBorder: "border-approval/40",
          containerBg: "bg-surface",
          badgeBg: "bg-approval/10 text-approval border-approval/30",
          verdictText: "text-approval",
          pillText: "PAYER CONSENT REQUIRED",
          headline: "REQUIRE_APPROVAL",
          subtitle: "Threshold or merchant approval rule triggered. Payer confirmation needed.",
          icon: <AlertTriangle className="h-7 w-7 text-approval shrink-0" strokeWidth={1.25} />,
        };
      case "DENY":
      default:
        return {
          containerBorder: "border-deny/40",
          containerBg: "bg-surface",
          badgeBg: "bg-deny/10 text-deny border-deny/30",
          verdictText: "text-deny",
          pillText: "POLICY BLOCKED",
          headline: "DENY",
          subtitle: "Transaction rejected. Exceeds cart/daily spend caps or violates safety rules.",
          icon: <XCircle className="h-7 w-7 text-deny shrink-0" strokeWidth={1.25} />,
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
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const listItemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.18 },
    },
  };

  return (
    <div
      className={`rounded-[6px] border p-6 transition-colors duration-150 ${style.containerBorder} ${style.containerBg}`}
    >
      {/* Top Bar: Large Verdict + Amount in Large Tabular Numerals */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-line">
        <div className="flex items-start gap-3.5">
          {/* Naked icon (no tinted square) */}
          <div className="shrink-0 mt-0.5">
            {style.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Real status: rounded-full pill */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border ${style.badgeBg}`}
              >
                {style.pillText}
              </span>
              <span className="text-[11px] font-mono text-text-dim">
                AIGENTRA ENGINE v1.0
              </span>
            </div>
            {/* Very Large Verdict */}
            <h2
              className={`text-2xl sm:text-3xl lg:text-4xl font-mono font-black uppercase tracking-tight mt-1 leading-none ${style.verdictText}`}
            >
              {style.headline}
            </h2>
            <p className="text-xs text-text-dim mt-1.5 max-w-xl leading-relaxed">
              {style.subtitle}
            </p>
          </div>
        </div>

        {/* Recomputed Amount in Large Tabular Numerals */}
        {totalCents !== undefined && (
          <div className="sm:text-right shrink-0 bg-surface-2 p-3 sm:p-3.5 rounded-[4px] border border-line">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
              Recomputed Total
            </div>
            <div className="flex items-baseline sm:justify-end gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-tight text-text">
                ${formatMoney(totalCents)}
              </span>
              <span className="text-xs font-mono font-bold text-text-dim">
                USD
              </span>
            </div>
            <div className="text-[10px] font-mono text-text-dim mt-0.5">
              Verified Server-Side
            </div>
          </div>
        )}
      </div>

      {/* Reason Codes Chips (Rectangular, not pills) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono font-bold uppercase text-text-dim mr-1">
          Reason Codes:
        </span>
        {reasonCodes.length === 0 ? (
          <span className="text-xs font-mono text-text-dim">None</span>
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
              ? "bg-deny/10 text-deny border-deny/30"
              : isApproval
              ? "bg-approval/10 text-approval border-approval/30"
              : "bg-allow/10 text-allow border-allow/30";

            return (
              <span
                key={code}
                className={`inline-flex items-center px-2.5 py-1 rounded-[4px] text-xs font-mono font-bold border tracking-wide ${chipColor}`}
              >
                {code}
              </span>
            );
          })
        )}
      </div>

      {/* Proposal Canonical Hash Chip (RFC 8785) with copy and toast */}
      <div className="mt-4 p-3 rounded-[4px] bg-surface-2 border border-line text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <Hash className="h-4 w-4 text-signal shrink-0" strokeWidth={1.25} />
          <span className="text-text-dim shrink-0 font-bold select-none">
            RFC 8785 SHA-256:
          </span>
          <span
            className="truncate text-text select-all font-mono"
            title={proposalHash}
          >
            {proposalHash}
          </span>
        </div>
        <button
          onClick={handleCopyHash}
          type="button"
          aria-label="Copy canonical proposal hash"
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-surface border border-line hover:border-line-strong text-text-dim hover:text-text transition-colors text-[11px] font-mono font-medium shrink-0 cursor-pointer"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-allow" strokeWidth={1.25} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.25} />
          )}
          <span>{copied ? "Copied" : "Copy Hash"}</span>
        </button>
      </div>

      {/* Rules Checklist Animated in with a Stagger */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-signal" strokeWidth={1.25} />
            <span>Deterministic Rules Checklist ({ruleResults.length})</span>
          </h3>
          <span className="text-[11px] font-mono text-text-dim">
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
              className={`flex items-start sm:items-center justify-between gap-2 text-xs py-2 px-3 rounded-[4px] border transition-colors ${
                r.passed
                  ? "bg-surface-2/60 border-line text-text"
                  : "bg-deny/5 border-deny/30 text-text"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {r.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-allow shrink-0 mt-0.5 sm:mt-0" strokeWidth={1.25} />
                ) : (
                  <XCircle className="h-4 w-4 text-deny shrink-0 mt-0.5 sm:mt-0" strokeWidth={1.25} />
                )}
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-text">
                    {r.rule}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold border ${
                      r.decision === "ALLOW"
                        ? "bg-allow/10 text-allow border-allow/30"
                        : r.decision === "REQUIRE_APPROVAL"
                        ? "bg-approval/10 text-approval border-approval/30"
                        : "bg-deny/10 text-deny border-deny/30"
                    }`}
                  >
                    {r.decision}
                  </span>
                </div>
              </div>
              <span
                className="text-[11px] font-mono text-text-dim text-right shrink-0 max-w-[280px] truncate"
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
        <div className="mt-5 pt-4 border-t border-line flex items-center justify-end gap-3">
          {verdict === "REQUIRE_APPROVAL" && (
            <a
              href="/approvals"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold rounded-[4px] bg-approval text-[#0B0C0E] hover:opacity-90 transition-opacity"
            >
              <ShieldCheck className="h-4 w-4 text-[#0B0C0E]" strokeWidth={1.25} />
              <span>Open Approval Centre</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1 text-[#0B0C0E]" strokeWidth={1.25} />
            </a>
          )}
          {verdict === "ALLOW" && (
            <button
              onClick={onProceed}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold rounded-[4px] bg-signal text-[#0B0C0E] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-[#0B0C0E]" strokeWidth={1.25} />
              <span>Proceed to PayPal Checkout</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1 text-[#0B0C0E]" strokeWidth={1.25} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
