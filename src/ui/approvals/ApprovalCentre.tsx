"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Edit3,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { PolicyRuleDefinition } from "@/rooms/authorize/types";
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
    } catch (err: any) {
      setError(err.message || "Failed to load approval requests");
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

  // Expiry countdown timer effect
  useEffect(() => {
    if (!mandateExpiresAt) {
      setCountdown("");
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(mandateExpiresAt).getTime();
      const diff = Math.max(0, expiry - now);

      if (diff === 0) {
        setCountdown("Expired");
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mandateExpiresAt]);

  const handleCopyHash = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(selectedItem.proposal.proposalHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
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
      await fetchApprovals();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
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
      await fetchApprovals();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
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
      await fetchApprovals();
      window.location.href = "/agent";
    } catch (err: any) {
      alert(`Error superseding proposal: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-status-approval" />
        <span className="text-sm font-medium">Loading Approval Centre queue...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-card border border-status-deny/30 bg-status-deny/10 text-status-deny flex items-center justify-between">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchApprovals}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-surface border border-border text-ink hover:bg-surface-elevated"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-status-allow/10 text-status-allow flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-ink">Approval Queue is Clear</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No proposals currently require human authorization. Cart proposals exceeding your $50.00
            approval threshold will automatically route here for your single-use signature.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-button bg-status-approval text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <ShoppingBag className="w-4 h-4" />
            Go to Agent Workspace
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Proposals Queue (4 cols) */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Queue ({items.length})
          </span>
          <button
            onClick={fetchApprovals}
            className="text-xs text-muted-foreground hover:text-ink flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
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
                className={`w-full text-left p-4 rounded-card border transition-all ${
                  isSelected
                    ? "border-status-approval bg-surface-elevated shadow-card"
                    : "border-border bg-surface hover:bg-surface-elevated/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {item.proposal.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      itemApproved
                        ? "bg-status-allow/10 text-status-allow border border-status-allow/30"
                        : itemRejected
                        ? "bg-status-deny/10 text-status-deny border border-status-deny/30"
                        : "bg-status-approval/10 text-status-approval border border-status-approval/30"
                    }`}
                  >
                    {item.proposal.state}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-ink">
                    ${formatMoney(item.proposal.totalCents)} {item.proposal.currency}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.proposal.itemsJson.length} item(s)
                  </span>
                </div>

                <div className="mt-2 text-xs text-muted-foreground truncate">
                  Hash: {item.proposal.proposalHash.slice(0, 10)}...
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Side-by-Side Proposal vs Policy (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-card border border-border bg-surface p-6 shadow-card space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ink">Proposal Review</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-elevated border border-border text-muted-foreground">
                  {proposal.id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluated against active guardrail version {policyRules?.name || "Home Office Guardrails"}
              </p>
            </div>

            {/* Status / Mandate Badge */}
            {mandate ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-allow/10 border border-status-allow/30 text-status-allow text-xs font-semibold">
                <Shield className="w-4 h-4" />
                <span>Mandate Issued ({mandate.grant})</span>
                {countdown && (
                  <span className="font-mono text-[11px] bg-surface/80 px-1.5 py-0.5 rounded">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {countdown}
                  </span>
                )}
              </div>
            ) : isRejected ? (
              <div className="px-3 py-1.5 rounded-full bg-status-deny/10 border border-status-deny/30 text-status-deny text-xs font-semibold">
                Rejected by Human
              </div>
            ) : isSuperseded ? (
              <div className="px-3 py-1.5 rounded-full bg-muted/30 border border-border text-muted-foreground text-xs font-semibold">
                Superseded (Invalidated)
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-full bg-status-approval/10 border border-status-approval/30 text-status-approval text-xs font-semibold">
                Action Required: Human Authorization
              </div>
            )}
          </div>

          {/* RFC 8785 Canonical Proposal Hash Chip */}
          <div className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-navy dark:text-brand-cyan" />
              <span className="text-xs font-medium text-muted-foreground">Canonical Hash (RFC 8785):</span>
              <span className="font-mono text-xs font-bold text-ink">
                {proposal.proposalHash.slice(0, 16)}...
              </span>
            </div>
            <button
              onClick={handleCopyHash}
              className="text-xs font-medium text-muted-foreground hover:text-ink flex items-center gap-1 transition-colors"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-status-allow" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedHash ? "Copied" : "Copy Full Hash"}
            </button>
          </div>

          {/* Side-by-Side Grid: Proposal vs Policy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Box: Itemized Proposal Summary */}
            <div className="space-y-4 rounded-card border border-border p-4 bg-surface-elevated/30">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-status-approval" />
                Proposed Cart Summary
              </h3>

              <div className="space-y-2">
                {proposal.itemsJson.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-surface border border-border text-xs space-y-1"
                  >
                    <div className="flex justify-between font-semibold text-ink">
                      <span className="truncate pr-2">{item.title || item.name || item.sku}</span>
                      <span>
                        ${formatMoney(item.unit_price_cents * item.quantity)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>Merchant: {item.merchant_domain || "unknown"}</span>
                      <span>Qty: {item.quantity} × ${formatMoney(item.unit_price_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border flex justify-between items-baseline">
                <span className="text-xs font-bold text-muted-foreground">Total Cart Value</span>
                <span className="text-xl font-extrabold text-ink">
                  ${formatMoney(proposal.totalCents)} {proposal.currency}
                </span>
              </div>
            </div>

            {/* Right Box: Policy Guardrail Limits */}
            <div className="space-y-4 rounded-card border border-border p-4 bg-surface-elevated/30">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-navy dark:text-brand-cyan" />
                Active Guardrail Policy
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded bg-surface border border-border">
                  <span className="text-muted-foreground">Approval Threshold:</span>
                  <span className="font-mono font-bold text-status-approval">
                    ${policyRules ? formatMoney(policyRules.approval_threshold_cents) : "50.00"} USD
                  </span>
                </div>

                <div className="flex justify-between p-2 rounded bg-surface border border-border">
                  <span className="text-muted-foreground">Cart Ceiling:</span>
                  <span className="font-mono font-bold text-ink">
                    ${policyRules ? formatMoney(policyRules.cart_max_cents) : "150.00"} USD
                  </span>
                </div>

                <div className="flex justify-between p-2 rounded bg-surface border border-border">
                  <span className="text-muted-foreground">Per-Item Limit:</span>
                  <span className="font-mono font-bold text-ink">
                    ${policyRules ? formatMoney(policyRules.per_item_max_cents) : "120.00"} USD
                  </span>
                </div>

                <div className="flex justify-between p-2 rounded bg-surface border border-border">
                  <span className="text-muted-foreground">Daily Spend Cap:</span>
                  <span className="font-mono font-bold text-ink">
                    ${policyRules ? formatMoney(policyRules.daily_cap_cents) : "200.00"} USD
                  </span>
                </div>

                <div className="p-2 rounded bg-surface border border-border text-[11px] text-muted-foreground">
                  Reason for review:{" "}
                  <span className="font-semibold text-status-approval">
                    {evaluation?.reason_codes.join(", ") || "OVER_APPROVAL_THRESHOLD"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleSupersede}
              disabled={actionLoading || isRejected || isSuperseded}
              className="px-4 py-2 text-xs font-semibold rounded-button border border-border bg-surface text-ink hover:bg-surface-elevated flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Cart (Supersedes Mandate)
            </button>

            <div className="flex items-center gap-3">
              {!isApproved && !isRejected && !isSuperseded && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-bold rounded-button border border-status-deny/40 bg-status-deny/10 text-status-deny hover:bg-status-deny/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-5 py-2 text-xs font-bold rounded-button bg-status-approval text-white hover:opacity-90 flex items-center gap-1.5 shadow-sm transition-opacity disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Issue Mandate
                  </button>
                </>
              )}

              {isApproved && (
                <Link
                  href={`/checkout?proposal_id=${proposal.id}`}
                  className="px-5 py-2 text-xs font-bold rounded-button bg-status-allow text-white hover:opacity-90 flex items-center gap-1.5 shadow-sm transition-opacity"
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
