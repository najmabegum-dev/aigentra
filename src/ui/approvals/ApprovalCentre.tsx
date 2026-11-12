"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Edit3,
  RefreshCw,
  ShoppingBag,
  AlertCircle,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { PolicyRuleDefinition } from "@/rooms/authorize/types";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";

interface ApprovalItem {
  proposal: {
    id: string;
    totalCents: number;
    currency: string;
    itemsJson: Array<{
      sku: string;
      title?: string;
      name?: string;
      merchant_domain?: string;
      unit_price_cents: number;
      quantity: number;
      category?: string;
    }>;
    proposalHash: string;
    state: string;
    createdAt: string;
  };
  evaluation: {
    decision: string;
    reason_codes: string[];
    rule_results: Array<{
      rule: string;
      passed: boolean;
      decision: string;
      message: string;
    }>;
  } | null;
  policyRules: PolicyRuleDefinition | null;
  mandate: {
    jti: string;
    grant: string;
    expiresAt: string;
    usedAt: string | null;
  } | null;
}

export function ApprovalCentre() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const [progressRatio, setProgressRatio] = useState<number>(1);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/approvals");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load approvals queue");
      }
      setItems(data.items || []);
      if (data.items?.length > 0 && !selectedId) {
        setSelectedId(data.items[0].proposal.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load approval requests";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItem = items.find((i) => i.proposal.id === selectedId) || items[0];
  const mandateExpiresAt = selectedItem?.mandate?.expiresAt;

  // Expiry countdown timer effect with visual ring progress ratio
  useEffect(() => {
    if (!mandateExpiresAt) {
      setCountdown("");
      setProgressRatio(1);
      return;
    }

    const totalWindowMs = 15 * 60 * 1000; // 15-minute standard mandate expiry window

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(mandateExpiresAt).getTime();
      const diff = Math.max(0, expiry - now);

      if (diff === 0) {
        setCountdown("Expired");
        setProgressRatio(0);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
        setProgressRatio(Math.min(1, Math.max(0, diff / totalWindowMs)));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [mandateExpiresAt]);

  const handleCopyHash = () => {
    if (!selectedItem) return;
    try {
      navigator.clipboard.writeText(selectedItem.proposal.proposalHash);
      setCopiedHash(true);
      toast.success("Canonical Proposal Hash Copied", {
        description: `RFC 8785: ${selectedItem.proposal.proposalHash.slice(0, 16)}...`,
      });
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      toast.error("Failed to copy hash to clipboard");
    }
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/proposals/${selectedItem.proposal.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Approval failed");
      }
      toast.success("Proposal Approved", {
        description: `Single-use Ed25519 Mandate issued for ${selectedItem.proposal.id}.`,
      });
      await fetchApprovals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      toast.error(`Approval error: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!confirm("Are you sure you want to reject this purchase proposal?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/proposals/${selectedItem.proposal.id}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Rejection failed");
      }
      toast.warning("Proposal Rejected", {
        description: "Proposal marked REJECTED and reservations released.",
      });
      await fetchApprovals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rejection failed";
      toast.error(`Rejection error: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupersede = async () => {
    if (!selectedItem) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/proposals/${selectedItem.proposal.id}/supersede`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Supersede failed");
      }
      toast.info("Proposal Superseded", {
        description: "Returning to Agent Workspace to edit cart...",
      });
      await fetchApprovals();
      window.location.href = "/agent";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Supersede failed";
      toast.error(`Error superseding proposal: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Skeleton loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
        {/* Left Column Queue Skeleton */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-[#060B14] space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex justify-between items-baseline">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column Details Skeleton */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-[#060B14] p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-3.5 w-64" />
              </div>
              <Skeleton className="h-8 w-36 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <div className="pt-4 border-t border-zinc-800 flex justify-between">
              <Skeleton className="h-11 w-36 rounded-lg" />
              <div className="flex gap-3">
                <Skeleton className="h-11 w-28 rounded-lg" />
                <Skeleton className="h-11 w-48 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-center justify-between font-mono">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-rose-400" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchApprovals}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#060B14] p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-white tracking-tight">Approval Queue is Clear</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            No proposals currently require human authorization. Cart proposals exceeding your $50.00
            approval threshold will automatically route here for your single-use signature.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Go to Agent Workspace</span>
          </Link>
        </div>
      </div>
    );
  }

  const proposal = selectedItem.proposal;
  const policyRules = selectedItem.policyRules;
  const evaluation = selectedItem.evaluation;
  const mandate = selectedItem.mandate;

  const isApproved = proposal.state === "APPROVED" || proposal.state === "MANDATED";
  const isRejected = proposal.state === "REJECTED" || proposal.state === "DENIED";
  const isSuperseded = proposal.state === "SUPERSEDED";

  // Comparison math for policy vs proposal
  const approvalThresholdCents = policyRules?.approval_threshold_cents ?? 5000;
  const cartMaxCents = policyRules?.cart_max_cents ?? 15000;
  const perItemMaxCents = policyRules?.per_item_max_cents ?? 12000;
  const dailyCapCents = policyRules?.daily_cap_cents ?? 20000;

  const exceedsThresholdByCents = Math.max(0, proposal.totalCents - approvalThresholdCents);
  const withinCartMax = proposal.totalCents <= cartMaxCents;

  // Circular ring calculations
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
      {/* Left Column: Proposals Queue (4 cols) */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
            Pending Queue ({items.length})
          </span>
          <button
            onClick={fetchApprovals}
            type="button"
            className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = item.proposal.id === selectedItem.proposal.id;
            const itemApproved = item.proposal.state === "APPROVED" || item.proposal.state === "MANDATED";
            const itemRejected = item.proposal.state === "REJECTED";

            return (
              <button
                key={item.proposal.id}
                onClick={() => setSelectedId(item.proposal.id)}
                type="button"
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-amber-500/60 bg-amber-500/5 shadow-[0_0_16px_rgba(245,158,11,0.08)] ring-1 ring-amber-500/30"
                    : "border-zinc-800 bg-[#060B14] hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-zinc-300">
                    {item.proposal.id}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                      itemApproved
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : itemRejected
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {item.proposal.state}
                  </span>
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="text-xl font-mono font-black tabular-nums text-white">
                    ${formatMoney(item.proposal.totalCents)}{" "}
                    <span className="text-xs font-normal text-zinc-400">{item.proposal.currency}</span>
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    {item.proposal.itemsJson.length} item(s)
                  </span>
                </div>

                <div className="mt-2 text-[11px] font-mono text-zinc-500 truncate">
                  SHA-256: {item.proposal.proposalHash.slice(0, 12)}...
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Clearer Two-Column Proposal vs Policy Comparison (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-[#060B14] p-6 shadow-sm space-y-6">
          {/* Header Bar with Expiry Countdown Ring */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">Proposal Authority Review</h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300 font-bold">
                  {proposal.id}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Evaluated against active guardrail version {policyRules?.name || "Home Office Guardrails"}
              </p>
            </div>

            {/* Expiry Countdown Ring & Status Display */}
            {mandate ? (
              <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400">
                {/* SVG Countdown Ring */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 54 54">
                    <circle
                      cx="27"
                      cy="27"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      className="text-zinc-800"
                    />
                    <circle
                      cx="27"
                      cy="27"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className={`transition-all duration-1000 ${
                        countdown === "Expired" ? "text-rose-500" : "text-emerald-400"
                      }`}
                    />
                  </svg>
                  <Clock className="w-4 h-4 text-emerald-400 absolute" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold leading-tight">
                    MANDATE ACTIVE ({mandate.grant})
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    Expires in:{" "}
                    <span className="font-bold text-white tabular-nums">
                      {countdown || "15:00"}
                    </span>
                  </div>
                </div>
              </div>
            ) : isRejected ? (
              <div className="px-3.5 py-2 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>Proposal Rejected by Human Signer</span>
              </div>
            ) : isSuperseded ? (
              <div className="px-3.5 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-xs font-mono font-bold">
                Superseded (Invalidated)
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-amber-950/20 border border-amber-500/40 text-amber-400">
                {/* Visual pulse ring for pending action */}
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                  <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400 opacity-20" />
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono font-bold">HUMAN CONSENT REQUIRED</div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    Awaiting Authority Sign-off
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RFC 8785 Canonical Proposal Hash Chip with Copy & Sonner Toast */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-[#060B14] border border-zinc-800 font-mono text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <Shield className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-zinc-500 font-semibold select-none">Canonical Hash (RFC 8785):</span>
              <span className="truncate text-zinc-200 select-all" title={proposal.proposalHash}>
                {proposal.proposalHash}
              </span>
            </div>
            <button
              onClick={handleCopyHash}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px] font-semibold shrink-0 cursor-pointer"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
            </button>
          </div>

          {/* Clearer Two-Column Proposal vs Policy Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Column 1: Proposed Cart Specification */}
            <div className="rounded-xl border border-zinc-800 p-5 bg-zinc-950/40 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    Proposed Cart Specification
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {proposal.itemsJson.length} item(s)
                  </span>
                </div>

                {/* Itemized List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {proposal.itemsJson.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#060B14] border border-zinc-800/80 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-start font-semibold text-white gap-2">
                        <span className="truncate">{item.title || item.name || item.sku}</span>
                        <span className="font-mono font-bold shrink-0 tabular-nums text-emerald-400">
                          ${formatMoney(item.unit_price_cents * item.quantity)}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400 text-[11px] font-mono">
                        <span className="truncate">Merchant: {item.merchant_domain || "unknown"}</span>
                        <span>
                          Qty {item.quantity} × ${formatMoney(item.unit_price_cents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Cart Value in Large Tabular Numerals */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase">
                    Cart Total Value
                  </span>
                  <div className="text-[10px] font-mono text-zinc-500">Recomputed Server-Side</div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-black tabular-nums text-white">
                    ${formatMoney(proposal.totalCents)}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-400 ml-1.5">
                    {proposal.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Active Policy Guardrails Comparison */}
            <div className="rounded-xl border border-zinc-800 p-5 bg-zinc-950/40 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-400" />
                    Active Guardrail Comparison
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Pure Policy Engine
                  </span>
                </div>

                {/* Policy Limits Comparison Rows */}
                <div className="space-y-2 text-xs font-mono">
                  {/* Approval Threshold Comparison */}
                  <div className="p-2.5 rounded-lg bg-[#060B14] border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-zinc-300 font-bold">Approval Threshold:</div>
                      <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                        {exceedsThresholdByCents > 0
                          ? `Exceeded by +$${formatMoney(exceedsThresholdByCents)} (Review Needed)`
                          : "Within auto-approval ceiling"}
                      </div>
                    </div>
                    <span className="font-bold text-amber-400 tabular-nums">
                      ${formatMoney(approvalThresholdCents)} USD
                    </span>
                  </div>

                  {/* Cart Max Ceiling */}
                  <div className="p-2.5 rounded-lg bg-[#060B14] border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-zinc-300">Cart Max Ceiling:</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {withinCartMax ? "Compliant (under cap)" : "Violated (Over cart cap)"}
                      </div>
                    </div>
                    <span className="font-bold text-white tabular-nums">
                      ${formatMoney(cartMaxCents)} USD
                    </span>
                  </div>

                  {/* Per-Item Limit */}
                  <div className="p-2.5 rounded-lg bg-[#060B14] border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-zinc-300">Per-Item Limit:</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Individual SKU limit</div>
                    </div>
                    <span className="font-bold text-white tabular-nums">
                      ${formatMoney(perItemMaxCents)} USD
                    </span>
                  </div>

                  {/* Daily Spend Cap */}
                  <div className="p-2.5 rounded-lg bg-[#060B14] border border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-zinc-300">Daily Spend Cap:</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">24h calendar ceiling</div>
                    </div>
                    <span className="font-bold text-white tabular-nums">
                      ${formatMoney(dailyCapCents)} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Evaluation Trigger Reason */}
              <div className="pt-2 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span>Trigger Reason:</span>
                <span className="font-bold text-amber-400">
                  {evaluation?.reason_codes.join(", ") || "OVER_APPROVAL_THRESHOLD"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer: Big Approve & Big Reject Buttons */}
          <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={handleSupersede}
              disabled={actionLoading || isRejected || isSuperseded}
              type="button"
              className="px-4 py-2.5 text-xs font-mono font-semibold rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Cart (Supersede)</span>
            </button>

            <div className="flex items-center gap-3">
              {!isApproved && !isRejected && !isSuperseded && (
                <>
                  {/* Big Reject Button */}
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    type="button"
                    className="px-6 py-3 text-sm font-mono font-bold rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Proposal</span>
                  </button>

                  {/* Big Approve Button */}
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    type="button"
                    className="px-7 py-3 text-sm font-mono font-black rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white flex items-center gap-2.5 shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/40 border border-emerald-400/30 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Approve &amp; Issue Mandate</span>
                  </button>
                </>
              )}

              {isApproved && (
                <Link
                  href={`/checkout?proposal_id=${proposal.id}`}
                  className="px-6 py-3 text-sm font-mono font-bold rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white flex items-center gap-2 shadow-lg shadow-blue-950/50 transition-all"
                >
                  <span>Proceed to PayPal Sandbox Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
