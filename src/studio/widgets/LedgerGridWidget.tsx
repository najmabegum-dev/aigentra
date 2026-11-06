"use client";

import React, { useState, useMemo } from "react";
import { Lock, Search, Filter, Layers, ExternalLink } from "lucide-react";
import Link from "next/link";

export interface LedgerEventItem {
  id: string;
  seq: number;
  entity_type: string;
  entity_id: string;
  type: string;
  actor: string;
  payload: Record<string, any>;
  prev_hash: string;
  event_hash: string;
  created_at: string;
  source: string;
  environment?: string;
}

export interface LedgerGridWidgetProps {
  events: LedgerEventItem[];
  workspaceId?: string;
  filterEntityType?: string | null;
  onFilterEntityType?: (entityType: string | null) => void;
  className?: string;
}

export function LedgerGridWidget({
  events = [],
  workspaceId = "demo",
  filterEntityType = null,
  onFilterEntityType,
  className = "",
}: LedgerGridWidgetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByEntity, setGroupByEntity] = useState(false);

  // Cross-filtering and search
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterEntityType && e.entity_type !== filterEntityType) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchType = e.type.toLowerCase().includes(query);
        const matchActor = e.actor.toLowerCase().includes(query);
        const matchEntity = e.entity_type.toLowerCase().includes(query);
        const matchHash = e.event_hash.toLowerCase().includes(query);
        return matchType || matchActor || matchEntity || matchHash;
      }
      return true;
    });
  }, [events, filterEntityType, searchQuery]);

  // Grouping by Entity
  const groupedEvents = useMemo(() => {
    if (!groupByEntity) return null;
    const groups: Record<string, LedgerEventItem[]> = {};
    for (const e of filteredEvents) {
      if (!groups[e.entity_type]) {
        groups[e.entity_type] = [];
      }
      groups[e.entity_type].push(e);
    }
    return groups;
  }, [filteredEvents, groupByEntity]);

  return (
    <div className={`rounded-card border border-border bg-surface overflow-hidden flex flex-col ${className}`}>
      {/* Grid Toolbar */}
      <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Ledger Audit Chain Grid
          </h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-sandbox/10 text-status-sandbox border border-status-sandbox/20">
            Sandbox
          </span>
          {filterEntityType && (
            <button
              onClick={() => onFilterEntityType?.(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
            >
              Filter: {filterEntityType} &times;
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter events, actors, hashes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-input border border-border bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary w-48 md:w-64"
            />
          </div>

          <button
            onClick={() => setGroupByEntity(!groupByEntity)}
            className={`px-3 py-1.5 rounded-input border text-xs font-medium transition-colors flex items-center gap-1 ${
              groupByEntity
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-surface text-ink hover:bg-muted"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Group by Entity
          </button>
        </div>
      </div>

      {/* Grid View */}
      <div className="overflow-x-auto max-h-96">
        {groupByEntity && groupedEvents ? (
          // Grouped Layout
          <div className="divide-y divide-border">
            {Object.entries(groupedEvents).map(([groupName, groupList]) => (
              <div key={groupName} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold uppercase rounded bg-muted text-ink">
                    {groupName} ({groupList.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {groupList.map((e) => (
                    <div
                      key={e.id}
                      className="p-2 rounded border border-border/60 bg-surface flex items-center justify-between text-xs hover:bg-muted/10 font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-ink">#{e.seq}</span>
                        <span className="font-semibold text-primary">{e.type}</span>
                        <span className="text-muted-foreground font-sans">by {e.actor}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground truncate max-w-xs" title={e.event_hash}>
                          {e.event_hash}
                        </span>
                        <Link
                          href={`/verify/${workspaceId}`}
                          className="text-primary hover:underline font-sans text-[11px]"
                        >
                          Verify &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Table Layout
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-medium border-b border-border sticky top-0">
              <tr>
                <th className="px-4 py-2.5">Seq</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Event Type</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Payload Preview</th>
                <th className="px-4 py-2.5">Event Hash</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3 font-bold text-ink">#{evt.seq}</td>
                  <td className="px-4 py-3 font-sans">
                    <button
                      onClick={() => onFilterEntityType?.(evt.entity_type)}
                      className="hover:underline font-semibold text-primary"
                    >
                      {evt.entity_type}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-ink">
                      {evt.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-sans">{evt.actor}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-xs font-sans text-[11px]">
                    {JSON.stringify(evt.payload || {})}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-xs" title={evt.event_hash}>
                    {evt.event_hash}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.source === "live"
                          ? "bg-status-allow/15 text-status-allow"
                          : "bg-status-approval/15 text-status-approval"
                      }`}
                    >
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
        )}
      </div>

      <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filteredEvents.length} of {events.length} events</span>
        <span className="font-semibold text-ink">RFC 8785 Canonical Chain</span>
      </div>
    </div>
  );
}
