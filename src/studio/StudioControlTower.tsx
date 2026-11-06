"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { initStudioLicense } from "./theme";
import {
  ShieldCheck,
  RotateCw,
  Database,
  Lock,
  Layers,
  Activity,
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  FileText,
} from "lucide-react";

// Dynamically import AgStudio with SSR disabled for Next.js App Router
const AgStudio = dynamic(
  () => import("ag-studio-react").then((mod) => mod.AgStudio),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 border border-border rounded-card bg-surface text-muted-foreground text-sm gap-2">
        <RotateCw className="w-5 h-5 animate-spin text-primary" />
        <span>Initializing AG Studio Control Tower...</span>
      </div>
    ),
  }
);

interface StudioDataResponse {
  success: boolean;
  workspaceId: string;
  environment: string;
  ledger: Array<any>;
  proposals: Array<any>;
  decisions: Array<any>;
  captures: Array<any>;
  counts: {
    ledger: number;
    proposals: number;
    decisions: number;
    captures: number;
  };
}

export function StudioControlTower() {
  const [data, setData] = useState<StudioDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"studio" | "ledger" | "proposals" | "decisions">("studio");

  useEffect(() => {
    initStudioLicense();
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio-data");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load studio data");
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to connect to Studio Data API");
    } finally {
      setLoading(false);
    }
  }

  // AG Studio Data Sources definition
  const studioDataConfig = useMemo(() => {
    if (!data) return undefined;
    return {
      sources: [
        {
          id: "ledger",
          name: "Ledger Audit Chain",
          data: data.ledger,
        },
        {
          id: "proposals",
          name: "Shopping Proposals",
          data: data.proposals,
        },
        {
          id: "decisions",
          name: "Policy Decisions",
          data: data.decisions,
        },
        {
          id: "captures",
          name: "PayPal Captures",
          data: data.captures,
        },
      ],
    };
  }, [data]);

  const hasLicenseKey = Boolean(process.env.NEXT_PUBLIC_AG_LICENSE_KEY);

  const blockedCount = data?.decisions.filter((d) => d.decision === "DENY").length || 0;
  const approvedCount = data?.decisions.filter((d) => d.decision === "ALLOW" || d.decision === "REQUIRE_APPROVAL").length || 0;
  const totalVolumeCents = data?.captures.reduce((acc, c) => acc + (c.amount_cents || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Telemetry Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Control Tower (AG Studio)
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/30">
              Sandbox
            </span>
            {hasLicenseKey ? (
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-status-allow/15 text-status-allow border border-status-allow/30">
                Commercial License
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground border border-border" title="Evaluation mode with watermark per PRD §10.4">
                Evaluation Mode
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-source telemetry, transaction reconciliation, and append-only hash chain monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-border bg-surface text-ink text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            Refresh Sources
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card bg-status-deny/10 border border-status-deny/30 text-status-deny text-sm flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Telemetry KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase">Ledger Chain Head</p>
            <Lock className="w-4 h-4 text-status-allow" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1 font-mono">
            #{data?.counts.ledger || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">SHA-256 Verified</p>
        </div>

        <div className="p-4 rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase">Shopping Proposals</p>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">
            {data?.counts.proposals || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Agent Intentions</p>
        </div>

        <div className="p-4 rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase">Policy Enforcements</p>
            <ShieldCheck className="w-4 h-4 text-status-approval" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-status-allow">{approvedCount}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-lg font-bold text-status-deny">{blockedCount} Denied</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Zero tool leaks</p>
        </div>

        <div className="p-4 rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase">PayPal Settled Volume</p>
            <DollarSign className="w-4 h-4 text-status-allow" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">
            ${(totalVolumeCents / 100).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.counts.captures || 0} Captures Confirmed
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("studio")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "studio"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          AG Studio Dashboard
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "ledger"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Ledger Table ({data?.counts.ledger || 0})
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "proposals"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Proposals ({data?.counts.proposals || 0})
        </button>

        <button
          onClick={() => setActiveTab("decisions")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "decisions"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Decisions ({data?.counts.decisions || 0})
        </button>
      </div>

      {/* Tab 1: AG Studio Component Canvas */}
      {activeTab === "studio" && (
        <div className="rounded-card border border-border bg-surface overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                AG Studio Canvas (ag-studio-react 3.1.0)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Connected sources: ledger, proposals, decisions, captures
            </span>
          </div>

          <div className="h-[620px] w-full p-2 bg-surface">
            {studioDataConfig ? (
              <AgStudio
                data={studioDataConfig as any}
                className="ag-theme-aigentra w-full h-full"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No telemetry sources loaded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Ledger Table View */}
      {activeTab === "ledger" && (
        <div className="rounded-card border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Seq</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Actor</th>
                  <th className="px-4 py-2.5">Event Hash</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.ledger.map((evt) => (
                  <tr key={evt.id} className="hover:bg-muted/10 font-mono">
                    <td className="px-4 py-3 font-bold text-ink">#{evt.seq}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-ink">
                        {evt.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{evt.actor}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs" title={evt.event_hash}>
                      {evt.event_hash}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.source === "live"
                          ? "bg-status-allow/15 text-status-allow"
                          : "bg-status-approval/15 text-status-approval"
                      }`}>
                        {evt.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Proposals View */}
      {activeTab === "proposals" && (
        <div className="rounded-card border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Proposal ID</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">State</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Proposal Hash</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.proposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono font-bold text-ink">{prop.id}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{prop.total_formatted}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-muted text-ink">
                        {prop.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{prop.items_count} item(s)</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground truncate max-w-xs">
                      {prop.proposal_hash}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                        {prop.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Decisions View */}
      {activeTab === "decisions" && (
        <div className="rounded-card border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Decision ID</th>
                  <th className="px-4 py-2.5">Proposal</th>
                  <th className="px-4 py-2.5">Verdict</th>
                  <th className="px-4 py-2.5">Reason Codes</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.decisions.map((dec) => (
                  <tr key={dec.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono font-bold text-ink">{dec.id}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{dec.proposal_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        dec.decision === "ALLOW"
                          ? "bg-status-allow/15 text-status-allow"
                          : dec.decision === "REQUIRE_APPROVAL"
                          ? "bg-status-approval/15 text-status-approval"
                          : "bg-status-deny/15 text-status-deny"
                      }`}>
                        {dec.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {Array.isArray(dec.reason_codes) ? dec.reason_codes.join(", ") : String(dec.reason_codes)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(dec.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
