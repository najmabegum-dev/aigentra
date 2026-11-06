"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CreditCard,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default function DevStubBuyerApprovalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("order_id") || "DEV-ORDER-SAMPLE";
  const token = searchParams.get("token") || "";
  const returnUrl = searchParams.get("return_url") || "/checkout?return=true";
  const cancelUrl = searchParams.get("cancel_url") || "/checkout?cancel=true";

  const [loading, setLoading] = useState(false);

  const handleSimulateApprove = async () => {
    try {
      setLoading(true);
      await fetch(`/api/dev-stub/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      // Redirect back to returnUrl with approved flag
      const target = new URL(returnUrl, window.location.origin);
      target.searchParams.set("order_id", orderId);
      target.searchParams.set("approved", "true");
      window.location.href = target.toString();
    } catch (e: any) {
      alert(`Simulation error: ${e.message}`);
      setLoading(false);
    }
  };

  const handleSimulateDecline = async () => {
    try {
      setLoading(true);
      await fetch(`/api/dev-stub/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      const target = new URL(returnUrl, window.location.origin);
      target.searchParams.set("order_id", orderId);
      target.searchParams.set("declined", "true");
      window.location.href = target.toString();
    } catch (e: any) {
      alert(`Simulation error: ${e.message}`);
      setLoading(false);
    }
  };

  const handleSimulateCancel = () => {
    const target = new URL(cancelUrl, window.location.origin);
    target.searchParams.set("cancelled", "true");
    window.location.href = target.toString();
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-900 dark:text-zinc-100">
      {/* Prominent Dev Stub Warning Banner */}
      <div className="w-full max-w-lg mb-6 p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500 text-amber-900 dark:text-amber-200 shadow-md">
        <div className="flex items-center gap-3 font-bold text-base">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <span>THIS IS NOT PAYPAL — DEV STUB SIMULATOR</span>
        </div>
        <p className="text-xs mt-1.5 leading-relaxed text-amber-800 dark:text-amber-300">
          You are viewing a local development stub (<code>PAYMENT_MODE=dev_stub</code>). This page simulates
          PayPal&apos;s buyer consent screen to demonstrate two-tier financial authorization without requiring live external network access.
        </p>
      </div>

      {/* Simulated Buyer Consent Modal */}
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#003087]/10 flex items-center justify-center font-bold text-[#003087] dark:text-[#0079C1]">
              P
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Simulated PayPal Checkout
              </h2>
              <span className="text-[11px] font-mono text-zinc-400">Sandbox Personal Buyer Account</span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {orderId.slice(0, 16)}...
          </span>
        </div>

        {/* Mandate & Anchor Details */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
          <div className="flex justify-between items-center text-zinc-500">
            <span>Simulated Payer:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">sandbox-buyer@aigentra.test</span>
          </div>
          <div className="flex justify-between items-center text-zinc-500">
            <span>Payment Method:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">PayPal Balance / Visa ****3001</span>
          </div>
          <div className="flex justify-between items-center text-zinc-500 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <span>AIGENTRA Anchor Hash:</span>
            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]" title={token}>
              Verified by Mandate
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSimulateApprove}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#0070BA] hover:bg-[#003087] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Authorize Simulated Buyer Consent</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSimulateDecline}
              disabled={loading}
              className="py-2.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 font-semibold text-xs hover:bg-rose-100 transition-colors"
            >
              Simulate Card Decline
            </button>
            <button
              onClick={handleSimulateCancel}
              disabled={loading}
              className="py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-semibold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel & Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
