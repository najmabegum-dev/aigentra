"use client";

/**
 * THROWAWAY SPIKE - NOT FOR PRODUCTION (PRD §8, P20)
 *
 * Temporary page for live testing @paypal/paypal-server-sdk against PayPal Sandbox:
 * 1. Checks credentials
 * 2. Creates an order for USD 10.00, intent CAPTURE, with PayPal-Request-Id
 * 3. Shows the approve link for sandbox buyer login
 * 4. Captures server-side and displays the status
 *
 * Never logs secrets.
 */

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Lock,
  Terminal,
} from "lucide-react";

interface SpikeStatus {
  configured: boolean;
  baseUrl: string;
}

interface OrderData {
  orderId: string;
  status: string;
  approveUrl: string;
  requestId: string;
}

interface CaptureData {
  orderId: string;
  status: string;
  captureId?: string;
  captureStatus?: string;
  amount?: string;
  raw?: any;
}

export default function SpikePage() {
  const [status, setStatus] = useState<SpikeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load configuration status on mount
  useEffect(() => {
    fetch("/api/spike")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => setError("Failed to check spike API: " + err.message));

    // Handle return URL callback from PayPal Sandbox
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || params.get("orderId");
      const step = params.get("step");

      if (token && step === "capture") {
        setOrder({
          orderId: token,
          status: "APPROVED_BY_BUYER",
          approveUrl: "",
          requestId: "from-callback",
        });
        // Auto-trigger server-side capture
        handleCapture(token);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      setCapture(null);

      const res = await fetch("/api/spike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      setOrder({
        orderId: data.orderId,
        status: data.status,
        approveUrl: data.approveUrl,
        requestId: data.requestId,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async (orderIdToCapture?: string) => {
    const id = orderIdToCapture || order?.orderId;
    if (!id) {
      setError("No order ID available to capture.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/spike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "capture", orderId: id }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to capture order");
      }

      setCapture(data);
    } catch (err: any) {
      setError(err?.message || "Failed to capture order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans antialiased">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* THROWAWAY SPIKE BANNER */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <div className="font-bold uppercase tracking-wider text-xs">
              THROWAWAY SPIKE — NOT FOR PRODUCTION (PRD §8, P20)
            </div>
            <div>
              Direct spike using <code className="bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-xs">@paypal/paypal-server-sdk</code> against PayPal Sandbox.
              Tests token generation, order creation (USD 10.00, intent CAPTURE), buyer approval flow, and server-side capture.
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              PayPal Sandbox Spike
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Validating live PayPal Sandbox credentials and API contract.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              USD 10.00 CAPTURE
            </span>
          </div>
        </div>

        {/* Credentials Status */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Lock className="w-4 h-4 text-slate-400" />
              PayPal Sandbox Credentials
            </div>
            {status?.configured ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Configured in environment
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Missing credentials
              </span>
            )}
          </div>

          {!status?.configured && (
            <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800 text-xs text-slate-400 space-y-2">
              <div>
                To execute live calls against PayPal Sandbox, add your sandbox credentials to your <code className="text-slate-200 font-mono">.env.local</code> file:
              </div>
              <pre className="p-2 rounded bg-slate-900 font-mono text-[11px] text-indigo-300 overflow-x-auto">
{`PAYPAL_CLIENT_ID="<your_sandbox_client_id>"
PAYPAL_CLIENT_SECRET="<your_sandbox_client_secret>"
APP_BASE_URL="http://localhost:3000"`}
              </pre>
              <div className="text-[11px] text-slate-500">
                (Never commit or paste secrets into public repositories)
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-xs uppercase tracking-wider">Error Encountered</div>
              <div className="text-xs mt-0.5 font-mono">{error}</div>
            </div>
          </div>
        )}

        {/* Step 1: Create Order */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Step 1: Order Creation
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                Create PayPal Order ($10.00 USD, intent CAPTURE)
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={loading || !status?.configured}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-sm transition-colors"
            >
              {loading && !order ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              Create Sandbox Order
            </button>
          </div>

          {order && (
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="text-indigo-300 font-bold">{order.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400">{order.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PayPal-Request-Id:</span>
                <span className="text-slate-300">{order.requestId}</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Buyer Approval */}
        {order?.approveUrl && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Step 2: Buyer Consent (PayPal Sandbox)
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                Authorize payment with Personal Sandbox Account
              </div>
              <p className="text-xs text-slate-400 mt-1">
                PayPal requires buyer interaction on its hosted page. Click the button below to approve in sandbox.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={order.approveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors"
              >
                <span>Approve on PayPal Sandbox</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-xs text-slate-500">
                (Sign in with your Personal Sandbox buyer account)
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-400 truncate">
              {order.approveUrl}
            </div>
          </div>
        )}

        {/* Step 3: Capture Order */}
        {order && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  Step 3: Server-Side Capture
                </div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  Capture Authorized Funds
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  After completing approval on PayPal, execute server-side capture.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCapture()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors"
              >
                {loading && capture === null ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Capture Server-Side
              </button>
            </div>

            {capture && (
              <div className="rounded-lg bg-slate-950 p-4 border border-emerald-500/30 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  CAPTURE SUCCESSFUL
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="text-slate-200">{capture.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Status:</span>
                  <span className="text-emerald-300 font-semibold">{capture.status}</span>
                </div>
                {capture.captureId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capture ID:</span>
                    <span className="text-indigo-300 font-bold">{capture.captureId}</span>
                  </div>
                )}
                {capture.amount && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Captured Amount:</span>
                    <span className="text-white font-bold">{capture.amount}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CLI Script Reference */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 font-semibold">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            CLI Throwaway Script
          </div>
          <p className="text-xs text-slate-400">
            You can also run this spike directly from your terminal using:
          </p>
          <pre className="p-3 rounded bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto space-y-1">
            <div><span className="text-slate-500"># 1. Create order & print approve URL:</span></div>
            <div><span className="text-indigo-400">npm run spike:paypal</span></div>
            <div className="pt-2"><span className="text-slate-500"># 2. After approving as sandbox buyer:</span></div>
            <div><span className="text-indigo-400">npm run spike:paypal capture &lt;orderId&gt;</span></div>
          </pre>
        </div>
      </div>
    </div>
  );
}
