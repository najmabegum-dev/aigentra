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
  Sliders,
} from "lucide-react";
import { AuthorityBudgetRing } from "./widgets/AuthorityBudgetRing";
import { DecisionMixWidget } from "./widgets/DecisionMixWidget";
import { BlockedAttemptsFeed } from "./widgets/BlockedAttemptsFeed";
import { ChainIntegrityBadge } from "./widgets/ChainIntegrityBadge";
import { LedgerGridWidget } from "./widgets/LedgerGridWidget";

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
  const [activeTab, setActiveTab] = useState<"dashboard" | "studio" | "ledger" | "proposals">("dashboard");

  // Cross-filtering states
  const [decisionFilter, setDecisionFilter] = useState<"ALLOW" | "REQUIRE_APPROVAL" | "DENY" | null>(null);
  const [entityFilter, setEntityFilter] = useState<string | null>(null);

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

  // Derived metrics
  const totalVolumeCents = data?.captures.reduce((acc, c) => acc + (c.amount_cents || 0), 0) || 0;
  const reservedCents = data?.proposals
    .filter((p) => p.state === "AUTHORIZED" || p.state === "ORDER_CREATED")
    .reduce((acc, p) => acc + (p.total_cents || 0), 0) || 0;

  // Filtered decisions for cross-filtering
  const filteredDecisions = useMemo(() => {
    if (!data?.decisions) return [];
    if (!decisionFilter) return data.decisions;
    return data.decisions.filter((d) => d.decision === decisionFilter);
  }, [data?.decisions, decisionFilter]);

  return (
    <div className="space-y-6 pb-16">
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

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "dashboard"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Saved Dashboard Layout (PRD §10.4)
        </button>

        <button
          onClick={() => setActiveTab("studio")}
          className={`px-4 py-2 rounded-input text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "studio"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-ink hover:bg-muted"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          AG Studio Component View
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
          Full Audit Trail ({data?.counts.ledger || 0})
        </button>
      </div>

      {/* Tab 1: Default Saved Dashboard Layout with 4 Custom Widgets & Grid */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Top Row: 3 Custom Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Widget 1: Authority Budget Ring */}
            <AuthorityBudgetRing
              spentCents={totalVolumeCents}
              reservedCents={reservedCents}
              dailyCapCents={20000}
              currency="USD"
            />

            {/* Widget 2: Decision Mix */}
            <DecisionMixWidget
              decisions={data?.decisions || []}
              selectedFilter={decisionFilter}
              onSelectFilter={setDecisionFilter}
            />

            {/* Widget 4: Chain Integrity Badge */}
            <ChainIntegrityBadge
              workspaceId={data?.workspaceId || "demo"}
              chainLength={data?.counts.ledger || 0}
              lastVerifiedAt={new Date().toLocaleTimeString()}
            />
          </div>

          {/* Middle Row: Blocked Attempts Feed with 'injected text' badge */}
          <BlockedAttemptsFeed
            attempts={data?.decisions || []}
          />

          {/* Bottom Row: Ledger Grid with custom status cells, grouping and cross-filtering */}
          <LedgerGridWidget
            events={data?.ledger || []}
            workspaceId={data?.workspaceId || "demo"}
            filterEntityType={entityFilter}
            onFilterEntityType={setEntityFilter}
          />
        </div>
      )}

      {/* Tab 2: Native AG Studio Component */}
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
              Multi-source data pipeline: ledger, proposals, decisions, captures
            </span>
          </div>

          <div className="h-[640px] w-full p-2 bg-surface">
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

      {/* Tab 3: Detailed Ledger View */}
      {activeTab === "ledger" && (
        <LedgerGridWidget
          events={data?.ledger || []}
          workspaceId={data?.workspaceId || "demo"}
          filterEntityType={entityFilter}
          onFilterEntityType={setEntityFilter}
        />
      )}
    </div>
  );
}
