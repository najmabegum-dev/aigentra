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
    <div className="w-full bg-surface border border-line rounded-[6px] p-5 sm:p-6 select-none font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-line gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-surface-2 border border-line text-signal font-mono text-xs font-bold">
            <Shield className="w-3.5 h-3.5 text-signal" strokeWidth={1.25} />
            <span>AUTHORITY RAIL</span>
          </div>
          <span className="text-xs text-text-dim font-mono">
            Two-Tier Financial Authorization: AIGENTRA Mandate → PayPal Execution
          </span>
        </div>

        {proposalId && (
          <a
            href={`/verify/${proposalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-text-dim hover:text-text flex items-center gap-1.5 transition-colors"
          >
            <span>Inspect Chain Proof</span>
            <ExternalLink className="w-3.5 h-3.5 text-signal" strokeWidth={1.25} />
          </a>
        )}
      </div>

      {/* Connected 5-Node Track on Desktop / Tablet */}
      <div className="relative">
        {/* Continuous Connecting Line Background */}
        <div className="hidden md:block absolute top-[26px] left-[6%] right-[6%] h-[2px] bg-line z-0">
          {/* Active Fill Track (Solid flat ink, no gradients) */}
          <div
            className={`h-full transition-all duration-300 ${
              isFailed ? "bg-deny" : "bg-signal"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 5 Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative z-10">
          {steps.map((step) => {
            const status = getStepStatus(step.num);
            const isComplete = status === "complete";
            const isCurrent = status === "current";
            const isStepFailed = status === "failed";
            const isAigentra = step.authority === "AIGENTRA";
            const StepIcon = step.icon;

            return (
              <div
                key={step.num}
                className={`relative flex flex-col justify-between p-3.5 rounded-[4px] border transition-colors duration-150 ${
                  isCurrent
                    ? "bg-surface-2 border-signal/60 ring-1 ring-signal/30"
                    : isComplete
                    ? "bg-surface-2/60 border-allow/40"
                    : isStepFailed
                    ? "bg-deny/5 border-deny/50"
                    : "bg-surface border-line opacity-60"
                }`}
              >
                {/* Node Indicator & Jurisdiction Badge */}
                <div className="flex items-center justify-between mb-3">
                  {/* Connected Node Circle (Flat ink, thin hairline borders) */}
                  <div className="relative">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                        isComplete
                          ? "bg-allow/15 text-allow border-allow/40"
                          : isCurrent
                          ? `bg-signal text-[#0B0C0E] border-signal ${
                              shouldReduceMotion ? "" : "animate-pulse"
                            }`
                          : isStepFailed
                          ? "bg-deny text-[#0B0C0E] border-deny"
                          : "bg-surface-2 text-text-dim border-line"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-allow" strokeWidth={1.25} />
                      ) : isStepFailed ? (
                        <XCircle className="w-4 h-4 text-[#0B0C0E]" strokeWidth={1.25} />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-[#0B0C0E]" strokeWidth={1.25} />
                      ) : (
                        <StepIcon className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.25} />
                      )}
                    </div>

                    {/* Indicator dot on current step */}
                    {isCurrent && !shouldReduceMotion && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal" />
                      </span>
                    )}
                  </div>

                  {/* Jurisdiction Badge: AIGENTRA vs PayPal (Rectangular, not pills) */}
                  <span
                    className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                      isAigentra
                        ? "bg-surface-2 text-text border-line"
                        : "bg-surface-2 text-text-dim border-line"
                    }`}
                  >
                    {step.authority}
                  </span>
                </div>

                {/* Step Titles */}
                <div>
                  <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-text-dim font-bold mb-0.5">
                    <span>STEP 0{step.num}</span>
                    <span>•</span>
                    <span className="truncate">{step.badge}</span>
                  </div>
                  <h4
                    className={`text-xs font-mono font-bold leading-snug tracking-tight ${
                      isCurrent
                        ? "text-signal"
                        : isComplete
                        ? "text-text"
                        : isStepFailed
                        ? "text-deny"
                        : "text-text-dim"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-text-dim leading-tight mt-1">
                    {step.desc}
                  </p>
                </div>

                {/* Timestamp & Status Footer */}
                <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-[10px] font-mono">
                  <span className="text-text-dim">
                    {step.time ? step.time : "Status:"}
                  </span>
                  <span
                    className={`font-bold tracking-wide ${
                      isComplete
                        ? "text-allow"
                        : isCurrent
                        ? "text-signal"
                        : isStepFailed
                        ? "text-deny"
                        : "text-text-dim"
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
                  <div className="mt-2 p-1.5 rounded-[4px] bg-deny/10 border border-deny/30 text-[10px] font-mono text-deny">
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
