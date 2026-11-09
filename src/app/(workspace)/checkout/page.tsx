"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Shield,
  CreditCard,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { AuthorityRail } from "@/ui/checkout/AuthorityRail";
import { formatMoney } from "@/lib/money";
import Link from "next/link";

interface CheckoutProposalData {
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
    }>;
    proposalHash: string;
    state: string;
  };
  mandate: {
    jti: string;
    token: string;
    grant: string;
    expiresAt: string;
  } | null;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("proposal_id") || "";
  const isReturn = searchParams.get("return") === "true";
  const isApproved = searchParams.get("approved") === "true" || searchParams.has("PayerID");
  const isDeclined = searchParams.get("declined") === "true";
  const isCancelled = searchParams.get("cancel") === "true";
  const orderId = searchParams.get("order_id") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckoutProposalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturedReceipt, setCapturedReceipt] = useState<{
    captureId: string;
    status: string;
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Load proposal & mandate details
  useEffect(() => {
    if (!proposalId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/proposals/${proposalId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load proposal details.");
        }

        // Fetch latest mandate for proposal
        const apprRes = await fetch(`/api/approvals`);
        const apprJson = await apprRes.json();
        let mandateObj = null;
        if (apprJson.success && Array.isArray(apprJson.items)) {
          const match = apprJson.items.find(
            (i: any) => i.proposal.id === proposalId
          );
          if (match?.mandate) {
            mandateObj = match.mandate;
          }
        }

        setData({
          proposal: json.proposal,
          mandate: mandateObj,
        });

        // If returned with buyer cancellation, notify server (PRD §8.3 Row 1)
        if (isCancelled && json.proposal.state !== "BUYER_CANCELLED") {
          await fetch("/api/checkout/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              proposal_id: proposalId,
              reason: "Buyer cancelled checkout flow on PayPal Sandbox",
            }),
          });
        }

        // If returned with buyer approval and not yet captured, auto-trigger return verification and capture
        if (isReturn && (isApproved || orderId) && orderId && mandateObj?.token) {
          await handleReturnAndCapture(orderId, mandateObj.token);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [proposalId, isReturn, isApproved, isCancelled, orderId]);

  const handleReturnAndCapture = async (paypalOrderId: string, token: string) => {
    try {
      setSubmitting(true);

      // 1. Verify return order from PayPal against the mandate (PRD §8.2 step 4, §8.3)
      const verifyRes = await fetch("/api/checkout/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: paypalOrderId,
          mandate_token: token,
        }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.success) {
        throw new Error(
          verifyJson.error || "Order validation against mandate failed (possible drift detected)."
        );
      }

      // 2. Execute capture through authority gate (PRD §8.2 step 5)
      const res = await fetch("/api/checkout/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: paypalOrderId,
          mandate_token: token,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Capture execution failed.");
      }

      setCapturedReceipt({
        captureId: json.capture_id,
        status: json.status,
      });
    } catch (err: any) {
      setError(err.message || "Failed to capture PayPal order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToPayPal = async () => {
    if (!data?.proposal || !data.mandate?.token) {
      alert("No active mandate token found for this proposal.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: data.proposal.id,
          mandate_token: data.mandate.token,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create PayPal order.");
      }

      if (json.approve_url) {
        window.location.href = json.approve_url;
      }
    } catch (err: any) {
      alert(`Checkout error: ${err.message}`);
      setSubmitting(false);
    }
  };

  const copyHash = () => {
    if (!data?.proposal.proposalHash) return;
    navigator.clipboard.writeText(data.proposal.proposalHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading checkout session...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto p-6 rounded-card border border-status-deny/30 bg-status-deny/10 text-status-deny space-y-4 text-center">
        <XCircle className="w-10 h-10 mx-auto" />
        <h2 className="text-lg font-bold">Checkout Error</h2>
        <p className="text-sm">{error || "Proposal not found or session expired."}</p>
        <Link
          href="/agent"
          className="inline-flex px-4 py-2 text-xs font-semibold rounded bg-surface border border-border text-ink hover:bg-surface-elevated"
        >
          Return to Agent Workspace
        </Link>
      </div>
    );
  }

  const proposal = data.proposal;
  const isCaptured = Boolean(capturedReceipt || proposal.state === "CAPTURED" || proposal.state === "CONFIRMED");
  const isBuyerCancelled = isCancelled || proposal.state === "BUYER_CANCELLED";
  const isCaptureDeclined = isDeclined || proposal.state === "CAPTURE_FAILED" || Boolean(error && (error.includes("declined") || error.includes("DECLINED")));
  const isDrift = proposal.state === "DRIFT_FLAGGED" || Boolean(error && (error.includes("DRIFT") || error.includes("drift")));

  // Determine current step on Authority Rail (1-5)
  let railStep: 1 | 2 | 3 | 4 | 5 = 2;
  if (isCaptured) {
    railStep = 5;
  } else if ((isApproved || isReturn) && orderId) {
    railStep = 4;
  } else if (proposal.state === "ORDER_CREATED") {
    railStep = 3;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
          <CreditCard className="w-6 h-6 text-primary" />
          PayPal Sandbox Checkout
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Authority-gated checkout execution. Two distinct authorizations: AIGENTRA Mandate &amp; PayPal Buyer Consent.
        </p>
      </div>

      {/* Authority Rail (PRD §10.3) */}
      <AuthorityRail currentStep={railStep} proposalId={proposal.id} />

      {/* Failure Notifications (PRD §8.3 Error Handling Matrix) */}
      {isBuyerCancelled && (
        <div className="p-4 rounded-card border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <div className="font-bold">Checkout Cancelled by Buyer (PRD §8.3 Row 1)</div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Authorization was cancelled on PayPal. Proposal state has been transitioned to <strong>BUYER_CANCELLED</strong> and spend reservations released. A new approval is required to retry.
            </p>
          </div>
        </div>
      )}

      {isCaptureDeclined && (
        <div className="p-4 rounded-card border border-status-deny/40 bg-status-deny/10 text-status-deny text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-status-deny" />
          <div className="space-y-1">
            <div className="font-bold">Payment Capture Declined (PRD §8.3 Row 2)</div>
            <p className="text-xs text-red-200/90 leading-relaxed">
              {error || "Your payment instrument was declined by PayPal (e.g. card declined or insufficient funds). State marked CAPTURE_FAILED. Mandate consumed; a new approval is required to retry."}
            </p>
          </div>
        </div>
      )}

      {isDrift && (
        <div className="p-4 rounded-card border border-status-deny bg-status-deny/20 text-status-deny text-sm flex items-start gap-3 animate-pulse">
          <Shield className="w-5 h-5 shrink-0 mt-0.5 text-status-deny" />
          <div className="space-y-1">
            <div className="font-bold tracking-wide">🚨 DRIFT FLAGGED: Financial Security Alert (PRD §8.3 Row 7)</div>
            <p className="text-xs text-red-200/90 leading-relaxed">
              Financial parameters differ between the PayPal order and the cryptographic mandate (amount or custom_id mismatch). Execution has been immediately halted and a tamper security event logged to the ledger.
            </p>
          </div>
        </div>
      )}

      {error && !isCaptureDeclined && !isDrift && !isBuyerCancelled && (
        <div className="p-4 rounded-card border border-status-deny/40 bg-status-deny/10 text-status-deny text-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-status-deny" />
          <div className="space-y-1">
            <div className="font-bold">Execution Error</div>
            <p className="text-xs text-red-200/90 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Proposal Details vs Execution Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left (7 cols): Order Cart Summary */}
        <div className="md:col-span-7 rounded-card border border-border bg-surface p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              Order Items ({proposal.itemsJson.length})
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {proposal.id}
            </span>
          </div>

          <div className="space-y-3">
            {proposal.itemsJson.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded bg-surface-elevated/40 border border-border text-xs"
              >
                <div>
                  <div className="font-semibold text-ink">
                    {item.title || item.name || item.sku}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {item.merchant_domain || "keychron.com"} &bull; Qty: {item.quantity}
                  </div>
                </div>
                <span className="font-mono font-bold text-ink">
                  ${formatMoney(item.unit_price_cents * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Canonical Hash Chip */}
          <div className="p-3 rounded bg-surface-elevated border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <Shield className="w-4 h-4 text-brand-navy dark:text-brand-cyan shrink-0" />
              <span className="text-muted-foreground font-medium">Hash:</span>
              <span className="font-mono font-bold text-ink truncate">
                {proposal.proposalHash}
              </span>
            </div>
            <button
              onClick={copyHash}
              className="text-muted-foreground hover:text-ink shrink-0 flex items-center gap-1"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-status-allow" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHash ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-border flex items-baseline justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Total Due</span>
            <span className="text-2xl font-extrabold text-ink">
              ${formatMoney(proposal.totalCents)} {proposal.currency}
            </span>
          </div>
        </div>

        {/* Right (5 cols): Authority Execution Action */}
        <div className="md:col-span-5 rounded-card border border-border bg-surface p-6 shadow-card space-y-6">
          <h2 className="text-base font-bold text-ink flex items-center gap-2 pb-3 border-b border-border">
            <Shield className="w-4 h-4 text-status-approval" />
            Execution Status
          </h2>

          {!isCaptured ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-status-approval/10 border border-status-approval/30 text-xs text-status-approval space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Mandate Issued &amp; Ready
                </div>
                <p className="leading-relaxed">
                  AIGENTRA has verified and signed this proposal. Proceed to PayPal to complete buyer authorization.
                </p>
              </div>

              <button
                onClick={handleProceedToPayPal}
                disabled={submitting || isBuyerCancelled || isCaptureDeclined || isDrift}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting to PayPal...
                  </>
                ) : (
                  <>
                    <span>Proceed to PayPal Buyer Consent</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-status-allow/10 text-status-allow flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Payment Captured</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Single-use mandate consumed. Order funds captured and anchored to proposal hash.
                </p>
              </div>

              <div className="p-3 rounded bg-surface-elevated border border-border text-xs font-mono space-y-1 text-left">
                <div className="text-muted-foreground text-[11px]">Capture ID:</div>
                <div className="font-bold text-ink break-all">
                  {capturedReceipt?.captureId || "COMPLETED"}
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/verify/${proposal.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-button bg-status-allow text-white font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  <span>Verify Ledger Chain</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
