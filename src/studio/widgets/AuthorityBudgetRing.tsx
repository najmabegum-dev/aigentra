"use client";

import React from "react";
import { DollarSign, ShieldAlert, CheckCircle2 } from "lucide-react";

export interface AuthorityBudgetRingProps {
  spentCents: number;
  reservedCents: number;
  dailyCapCents: number;
  currency?: string;
  className?: string;
}

export function AuthorityBudgetRing({
  spentCents,
  reservedCents,
  dailyCapCents = 20000, // Default $200.00
  currency = "USD",
  className = "",
}: AuthorityBudgetRingProps) {
  const cap = Math.max(dailyCapCents, 1);
  const totalAllocated = spentCents + reservedCents;
  const remainingCents = Math.max(cap - totalAllocated, 0);

  const spentPct = Math.min((spentCents / cap) * 100, 100);
  const reservedPct = Math.min((reservedCents / cap) * 100, 100 - spentPct);
  const usedPct = Math.min((totalAllocated / cap) * 100, 100);

  // SVG Ring calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usedPct / 100) * circumference;

  const isNearLimit = usedPct >= 80;
  const isCapped = usedPct >= 100;

  return (
    <div className={`p-5 rounded-card border border-border bg-surface flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Authority Budget Ring
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/20">
          Sandbox
        </span>
      </div>

      <div className="my-4 flex items-center justify-center gap-6">
        {/* Circular SVG Ring */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-muted stroke-current"
              strokeWidth="9"
              fill="transparent"
            />
            {/* Active gauge */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={`${
                isCapped
                  ? "text-status-deny"
                  : isNearLimit
                  ? "text-status-approval"
                  : "text-primary"
              } stroke-current transition-all duration-500 ease-out`}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-ink">
              {Math.round(usedPct)}%
            </span>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              Utilized
            </span>
          </div>
        </div>

        {/* Legend / Values */}
        <div className="space-y-2 text-xs">
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              <span>Spent</span>
            </div>
            <p className="font-mono font-bold text-ink pl-3.5">
              ${(spentCents / 100).toFixed(2)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <span className="w-2 h-2 rounded-full bg-status-approval inline-block" />
              <span>Reserved</span>
            </div>
            <p className="font-mono font-bold text-ink pl-3.5">
              ${(reservedCents / 100).toFixed(2)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
              <span>Remaining</span>
            </div>
            <p className="font-mono font-bold text-ink pl-3.5">
              ${(remainingCents / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Daily Authority Cap:</span>
        <span className="font-mono font-bold text-ink">${(cap / 100).toFixed(2)} {currency}</span>
      </div>
    </div>
  );
}
