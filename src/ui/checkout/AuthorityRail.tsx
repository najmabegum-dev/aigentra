"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  CreditCard,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

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
}

export function AuthorityRail({
  currentStep,
  stepTimes = {},
  proposalId,
}: AuthorityRailProps) {
  const steps = [
    {
      num: 1,
      title: "Policy Decision",
      authority: "AIGENTRA",
      desc: "Deterministic rules evaluation",
      icon: Shield,
      time: stepTimes.policyDecision,
    },
    {
      num: 2,
      title: "AIGENTRA Approval",
      authority: "AIGENTRA",
      desc: "Ed25519 single-use Mandate",
      icon: Lock,
      time: stepTimes.approvalOrGrant,
    },
    {
      num: 3,
      title: "PayPal Buyer Consent",
      authority: "PayPal",
      desc: "Payer authorization on PayPal",
      icon: CreditCard,
      time: stepTimes.buyerConsent,
    },
    {
      num: 4,
      title: "Funds Capture",
      authority: "PayPal",
      desc: "Server-side capture executed",
      icon: CheckCircle2,
      time: stepTimes.capture,
    },
    {
      num: 5,
      title: "Ledger Sealed",
      authority: "AIGENTRA",
      desc: "Webhook verified & hashed",
      icon: Shield,
      time: stepTimes.webhookConfirmed,
    },
  ];

  return (
    <div className="w-full bg-surface border border-border rounded-card p-6 shadow-card space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Authority Rail (Two-Tier Financial Authorization)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-navy/10 dark:bg-brand-cyan/10 text-brand-navy dark:text-brand-cyan font-semibold border border-brand-navy/20 dark:border-brand-cyan/20">
            PRD §10.3
          </span>
        </div>
        {proposalId && (
          <a
            href={`/verify/${proposalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-ink flex items-center gap-1 transition-colors"
          >
            <span>Inspect Chain</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* 5-Step Horizontal Rail */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          let status: RailStepStatus = "pending";
          if (step.num < currentStep) {
            status = "complete";
          } else if (step.num === currentStep) {
            status = "current";
          }

          const isComplete = status === "complete";
          const isCurrent = status === "current";
          const isAigentra = step.authority === "AIGENTRA";

          const StepIcon = step.icon;

          return (
            <div
              key={step.num}
              className={`relative p-3.5 rounded-card border transition-all ${
                isCurrent
                  ? "border-status-approval bg-status-approval/5 shadow-xs ring-1 ring-status-approval/30"
                  : isComplete
                  ? "border-status-allow/40 bg-status-allow/5"
                  : "border-border/60 bg-surface/50 opacity-60"
              }`}
            >
              {/* Step Authority Tag */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isAigentra
                      ? "bg-brand-navy/10 text-brand-navy dark:bg-brand-cyan/15 dark:text-brand-cyan"
                      : "bg-[#003087]/15 text-[#003087] dark:bg-[#0079C1]/20 dark:text-[#0079C1]"
                  }`}
                >
                  {step.authority}
                </span>
                <span className="font-mono text-[11px] font-bold text-muted-foreground">
                  0{step.num}
                </span>
              </div>

              {/* Step Title & Icon */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isComplete
                      ? "bg-status-allow text-white"
                      : isCurrent
                      ? "bg-status-approval text-white animate-pulse"
                      : "bg-surface-elevated text-muted-foreground border border-border"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <StepIcon className="w-3 h-3" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-ink truncate leading-tight">
                    {step.title}
                  </h4>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Timestamp row */}
              <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between font-mono">
                <span>Status:</span>
                <span
                  className={`font-semibold ${
                    isComplete
                      ? "text-status-allow"
                      : isCurrent
                      ? "text-status-approval"
                      : "text-muted-foreground"
                  }`}
                >
                  {isComplete ? "Done" : isCurrent ? "In Progress" : "Waiting"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
