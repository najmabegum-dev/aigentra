"use client";

import { useEffect, useState, useTransition } from "react";
import canonicalize from "canonicalize";
import Link from "next/link";

interface LedgerEventItem {
  id: string;
  seq: number;
  entityType: string;
  entityId: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  prevHash: string;
  eventHash: string;
  createdAt: string;
}

interface VerificationData {
  ok: boolean;
  valid: boolean;
  totalEvents: number;
  brokenAtSeq: number | null;
  reason: string | null;
  publicKey: string;
  transaction: {
    proposalId: string;
    proposalHash: string;
    amountCents: number;
    currency: string;
    state: string;
    paypalOrderId: string | null;
    captureId: string | null;
    createdAt: string;
  } | null;
  events: LedgerEventItem[];
}

interface ClientVerificationResult {
  clientVerified: boolean;
  brokenAtSeq: number | null;
  reason: string | null;
  calculatedHashes: Record<number, string>;
}

async function sha256Browser(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function VerifyTransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientResult, setClientResult] = useState<ClientVerificationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tampering, setTampering] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchVerification = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/verify/${params.id}`);
      if (!res.ok) {
        throw new Error(`Failed to load verification proof: HTTP ${res.status}`);
      }
      const json: VerificationData = await res.json();
      setData(json);

      // Recompute the chain IN THE BROWSER (PRD F8, §10.3)
      if (json.events && json.events.length > 0) {
        const clientCheck = await verifyChainInBrowser(json.events);
        setClientResult(clientCheck);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verification data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function verifyChainInBrowser(
    events: LedgerEventItem[]
  ): Promise<ClientVerificationResult> {
    const calculatedHashes: Record<number, string> = {};
    let expectedPrevHash = "0".repeat(64);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expectedSeq = i + 1;

      if (event.seq !== expectedSeq) {
        return {
          clientVerified: false,
          brokenAtSeq: event.seq,
          reason: `Sequence gap: expected #${expectedSeq}, got #${event.seq}`,
          calculatedHashes,
        };
      }

      if (event.prevHash !== expectedPrevHash) {
        return {
          clientVerified: false,
          brokenAtSeq: event.seq,
          reason: `Previous hash link broken: expected ${expectedPrevHash.slice(0, 16)}..., got ${event.prevHash.slice(0, 16)}...`,
          calculatedHashes,
        };
      }

      const canonicalPayload = canonicalize({
        workspace_id: event.payload && (event.payload as any).workspace_id ? (event.payload as any).workspace_id : undefined,
        seq: event.seq,
        entity_type: event.entityType,
        entity_id: event.entityId,
        type: event.type,
        actor: event.actor,
        payload: event.payload,
        prev_hash: event.prevHash,
      });

      // Note: server computes sha256(prev_hash + canonicalize(eventData))
      // Let's compute using standard client event format
      const clientCanonical = canonicalize({
        workspace_id: (event as any).workspaceId || (event.payload as any)?.workspace_id || params.id,
        seq: event.seq,
        entity_type: event.entityType,
        entity_id: event.entityId,
        type: event.type,
        actor: event.actor,
        payload: event.payload,
        prev_hash: event.prevHash,
      });

      const recomputed = await sha256Browser(event.prevHash + (clientCanonical || ""));
      calculatedHashes[event.seq] = recomputed;

      if (event.eventHash !== recomputed) {
        return {
          clientVerified: false,
          brokenAtSeq: event.seq,
          reason: `Cryptographic hash mismatch at seq #${event.seq}: Stored hash differs from recomputed SHA-256 digest`,
          calculatedHashes,
        };
      }

      expectedPrevHash = event.eventHash;
    }

    return {
      clientVerified: true,
      brokenAtSeq: null,
      reason: null,
      calculatedHashes,
    };
  }

  const handleTamperDemo = async () => {
    try {
      setTampering(true);
      const res = await fetch(`/api/verify/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      if (res.ok) {
        await fetchVerification();
      }
    } catch (err) {
      console.error("Tamper demo error:", err);
    } finally {
      setTampering(false);
    }
  };

  const copyPublicKey = () => {
    if (data?.publicKey) {
      navigator.clipboard.writeText(data.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const isChainValid = data?.valid && clientResult?.clientVerified !== false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header navigation & Sandbox banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700">
                Sandbox Audit Mode
              </span>
              <span className="text-xs font-mono text-slate-400">
                PRD §7 / F8 Public Proof Ledger
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-1 text-slate-100">
              Cryptographic Transaction Verification
            </h1>
          </div>
          <Link
            href="/checkout"
            className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-900 border border-slate-700 transition"
          >
            ← Return to Checkout
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            <p className="text-sm">Fetching immutable ledger proof & recomputing SHA-256 chain...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-lg bg-red-950/40 border border-red-800 text-red-300 space-y-2">
            <h3 className="font-semibold text-lg">Verification Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Primary Status Banner */}
            <div
              className={`p-6 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                isChainValid
                  ? "bg-emerald-950/30 border-emerald-700 text-emerald-100"
                  : "bg-red-950/40 border-red-700 text-red-100"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isChainValid ? "bg-emerald-400 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  <h2 className="text-xl font-bold tracking-tight">
                    {isChainValid
                      ? "CHAIN VERIFIED: OK"
                      : "CHAIN INTEGRITY VIOLATION: BROKEN"}
                  </h2>
                </div>
                <p className="text-sm text-slate-300">
                  {isChainValid
                    ? `All ${data.totalEvents} sequential ledger blocks verified byte-for-byte in your browser via SHA-256.`
                    : clientResult?.reason || data.reason || `Integrity violated at block sequence #${data.brokenAtSeq}`}
                </p>
              </div>

              {/* Tamper demo button */}
              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <button
                  onClick={handleTamperDemo}
                  disabled={tampering}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide border transition shadow-sm w-full sm:w-auto ${
                    isChainValid
                      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-600/50"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-600/50"
                  }`}
                >
                  {tampering
                    ? "Updating Database..."
                    : isChainValid
                    ? "⚠️ Tamper Demo: Corrupt 1 Stored Event"
                    : "🔄 Restore Original Event"}
                </button>
                <span className="text-[10px] text-slate-400">
                  Sandbox only — simulates Threat A7 ledger attack
                </span>
              </div>
            </div>

            {/* Transaction Metadata Card */}
            {data.transaction && (
              <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Transaction Metadata
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 rounded bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Proposal Hash
                    </span>
                    <span className="text-slate-200 truncate block mt-1" title={data.transaction.proposalHash}>
                      {data.transaction.proposalHash.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="p-3 rounded bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Amount Authorized
                    </span>
                    <span className="text-emerald-400 font-bold block mt-1">
                      ${(data.transaction.amountCents / 100).toFixed(2)} {data.transaction.currency}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      PayPal Order ID
                    </span>
                    <span className="text-blue-400 block mt-1 truncate">
                      {data.transaction.paypalOrderId || "PENDING"}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      PayPal Capture ID
                    </span>
                    <span className="text-indigo-400 block mt-1 truncate">
                      {data.transaction.captureId || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Public Key Display */}
            {data.publicKey && (
              <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Authority Ed25519 Public Signing Key (SPKI)
                  </h4>
                  <button
                    onClick={copyPublicKey}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {copiedKey ? "✓ Copied" : "Copy PEM"}
                  </button>
                </div>
                <pre className="text-[10px] font-mono p-3 bg-slate-950 rounded border border-slate-800 text-slate-400 overflow-x-auto whitespace-pre">
                  {data.publicKey.trim()}
                </pre>
              </div>
            )}

            {/* Interactive Block Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Hash-Chained Audit Blocks ({data.events.length})
                </h3>
                <span className="text-xs text-slate-500">
                  Formula: sha256(prev_hash + canonical(event))
                </span>
              </div>

              <div className="space-y-3">
                {data.events.map((evt, idx) => {
                  const isTamperedRow =
                    data.brokenAtSeq === evt.seq ||
                    (clientResult && clientResult.brokenAtSeq === evt.seq);
                  return (
                    <div
                      key={evt.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isTamperedRow
                          ? "bg-red-950/30 border-red-600 shadow-md shadow-red-950/50"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/60 pb-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 text-xs font-mono font-bold rounded ${
                              isTamperedRow
                                ? "bg-red-900/80 text-red-200 border border-red-600"
                                : "bg-blue-900/40 text-blue-300 border border-blue-800/50"
                            }`}
                          >
                            Block #{evt.seq}
                          </span>
                          <span className="font-semibold text-sm text-slate-200 font-mono">
                            {evt.type}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            actor: {evt.actor}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-mono font-semibold ${
                              isTamperedRow ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {isTamperedRow ? "✖ Integrity Breach" : "✓ Hash Verified"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block uppercase font-sans">
                            Previous Hash (prev_hash)
                          </span>
                          <span className="text-slate-400 break-all text-[11px] block mt-0.5">
                            {evt.prevHash}
                          </span>
                        </div>
                        <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block uppercase font-sans">
                            Event Hash (event_hash)
                          </span>
                          <span className="text-slate-300 break-all text-[11px] block mt-0.5">
                            {evt.eventHash}
                          </span>
                        </div>
                      </div>

                      {/* Payload preview */}
                      <details className="mt-3 group">
                        <summary className="text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                          View Block Payload JSON ▸
                        </summary>
                        <pre className="mt-2 p-3 rounded bg-slate-950 border border-slate-800/90 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(evt.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
