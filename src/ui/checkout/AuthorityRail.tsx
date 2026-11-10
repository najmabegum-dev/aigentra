"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  CreditCard,
  Lock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useReducedMotion } from "motion/react";

export type RailStepStatus = "complete" | "current" | "pending" | "failed";

export interface AuthorityRailProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  stepTimes?: {
    policyDecision?: string;
    approvalOrGrant?: string;
    buyerConsent?: string;
    capture?: string;
    webhookConfirmed?: string;
  };
  proposalId?: string;
  isFailed?: boolean;
  failureStep?: number;
  failureReason?: string;
}

export function AuthorityRail({
  currentStep,
  stepTimes = {},
  proposalId,
  isFailed = false,
  failureStep,
  failureReason,
}: AuthorityRailProps) {
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      num: 1,
      title: "Policy Decision",
      authority: "AIGENTRA",
      desc: "Deterministic rules evaluation",
      badge: "Pure Policy Engine",
      icon: Shield,
      time: stepTimes.policyDecision,
    },
    {
      num: 2,
      title: "AIGENTRA Approval",
      authority: "AIGENTRA",
      desc: "Ed25519 single-use Mandate",
      badge: "RFC 8785 Hash JWS",
      icon: Lock,
      time: stepTimes.approvalOrGrant,
    },
    {
      num: 3,
      title: "PayPal Buyer Consent",
      authority: "PayPal",
      desc: "Payer authorization on PayPal",
      badge: "Sandbox Approval",
      icon: CreditCard,
      time: stepTimes.buyerConsent,
    },
    {
      num: 4,
      title: "Capture",
      authority: "PayPal",
      desc: "Server-side capture executed",
      badge: "PayPal Server SDK",
      icon: Zap,
      time: stepTimes.capture,
    },
    {
      num: 5,
      title: "Webhook Confirmed & Ledger Sealed",
      authority: "AIGENTRA",
      desc: "Signature verified & chained",
      badge: "SHA-256 Hash Chain",
      icon: ShieldCheck,
      time: stepTimes.webhookConfirmed,
    },
  ];

  // Helper to determine status of step
  const getStepStatus = (stepNum: number): RailStepStatus => {
    if (isFailed && (failureStep === stepNum || (!failureStep && stepNum === currentStep))) {
      return "failed";
    }
    if (stepNum < currentStep) return "complete";
    if (stepNum === currentStep) return isFailed ? "failed" : "current";
    return "pending";
  };

  // Progress percentage (0 to 100%) for visual rail track
  const progressPercent = Math.min(100, Math.max(0, ((currentStep - 1) / 4) * 100));

  return (
    <div className="w-full bg-white dark:bg-[#0B1324] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-zinc-200 dark:border-zinc-800 gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
            <span>AUTHORITY RAIL</span>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Two-Tier Financial Authorization: AIGENTRA Mandate → PayPal Execution
          </span>
        </div>

        {proposalId && (
          <a
            href={`/verify/${proposalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <span>Inspect Chain Proof</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
          </a>
        )}
      </div>

      {/* Connected 5-Node Track on Desktop / Tablet */}
      <div className="relative">
        {/* Continuous Connecting Line Background */}
        <div className="hidden md:block absolute top-[28px] left-[6%] right-[6%] h-[3px] bg-zinc-200 dark:bg-zinc-800 z-0 rounded-full">
          {/* Active Fill Track */}
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isFailed
                ? "bg-rose-500"
                : "bg-gradient-to-r from-emerald-500 via-blue-500 to-sky-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 5 Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
          {steps.map((step) => {
            const status = getStepStatus(step.num);
            const isComplete = status === "complete";
            const isCurrent = status === "current";
            const isPending = status === "pending";
            const isStepFailed = status === "failed";
            const isAigentra = step.authority === "AIGENTRA";
            const StepIcon = step.icon;

            return (
              <div
                key={step.num}
                className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? "bg-blue-50/50 dark:bg-[#101B33] border-blue-500/50 dark:border-blue-500/40 shadow-[0_0_16px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30"
                    : isComplete
                    ? "bg-emerald-50/30 dark:bg-[#06181B]/40 border-emerald-500/40 dark:border-emerald-500/30"
                    : isStepFailed
                    ? "bg-rose-50/40 dark:bg-rose-950/30 border-rose-500/50 dark:border-rose-500/40 shadow-[0_0_16px_rgba(244,63,94,0.15)]"
                    : "bg-zinc-50/60 dark:bg-[#060B14]/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-70"
                }`}
              >
                {/* Node Indicator & Jurisdiction Badge */}
                <div className="flex items-center justify-between mb-3">
                  {/* Connected Node Circle */}
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isComplete
                          ? "bg-emerald-500 text-white border-emerald-400 shadow-xs"
                          : isCurrent
                          ? `bg-blue-600 text-white border-blue-400 ring-4 ring-blue-500/20 ${
                              shouldReduceMotion ? "" : "animate-pulse"
                            }`
                          : isStepFailed
                          ? "bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/20"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isStepFailed ? (
                        <XCircle className="w-5 h-5" />
                      ) : isCurrent ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>

                    {/* Pulsing indicator dot on current step */}
                    {isCurrent && !shouldReduceMotion && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                      </span>
                    )}
                  </div>

                  {/* Jurisdiction Badge: AIGENTRA vs PayPal */}
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isAigentra
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                        : "bg-[#0079C1]/15 text-[#00457C] dark:text-[#38bdf8] border-[#0079C1]/30"
                    }`}
                  >
                    {step.authority}
                  </span>
                </div>

                {/* Step Titles */}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold mb-0.5">
                    <span>STEP 0{step.num}</span>
                    <span>•</span>
                    <span className="truncate">{step.badge}</span>
                  </div>
                  <h4
                    className={`text-xs font-bold leading-snug tracking-tight ${
                      isCurrent
                        ? "text-blue-600 dark:text-blue-400"
                        : isComplete
                        ? "text-zinc-900 dark:text-zinc-100"
                        : isStepFailed
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-1">
                    {step.desc}
                  </p>
                </div>

                {/* Timestamp & Status Footer */}
                <div className="mt-4 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {step.time ? step.time : "Status:"}
                  </span>
                  <span
                    className={`font-semibold tracking-wide ${
                      isComplete
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isCurrent
                        ? "text-blue-600 dark:text-blue-400 font-bold"
                        : isStepFailed
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {isComplete
                      ? "Complete"
                      : isCurrent
                      ? "Active"
                      : isStepFailed
                      ? "Failed"
                      : "Pending"}
                  </span>
                </div>

                {/* Optional Failure Reason message */}
                {isStepFailed && failureReason && (
                  <div className="mt-2 p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-600 dark:text-rose-400">
                    {failureReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
