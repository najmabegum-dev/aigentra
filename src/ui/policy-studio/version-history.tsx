"use client";

import { History, Check, Clock } from "lucide-react";
import type { PolicyRuleDefinition } from "@/rooms/authorize/types";
import { centsToPayPalString } from "@/lib/money";

export interface VersionItem {
  id: string;
  version: number;
  createdAt: string | Date;
  rulesJson: unknown;
}

interface VersionHistoryProps {
  versions: VersionItem[];
  selectedVersionNumber: number;
  onSelectVersion: (versionNumber: number) => void;
}

export function VersionHistory({
  versions,
  selectedVersionNumber,
  onSelectVersion,
}: VersionHistoryProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2 text-ink font-bold text-sm">
          <History className="w-4 h-4 text-primary" />
          <span>Immutable Version History</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {versions.length} version{versions.length === 1 ? "" : "s"} recorded
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {versions.map((v) => {
          const rules = v.rulesJson as PolicyRuleDefinition;
          const isSelected = v.version === selectedVersionNumber;
          const isLatest = v.version === versions[0]?.version;
          const dateStr = new Date(v.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVersion(v.version)}
              className={`w-full text-left p-3 rounded-input border transition-all text-xs flex items-center justify-between gap-3 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:bg-muted/50 bg-surface"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-ink">v{v.version}</span>
                  {isLatest && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Current
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                      rules?.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : rules?.status === "PAUSED"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : rules?.status === "REVOKED"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rules?.status || "DRAFT"}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                  <span>•</span>
                  <span>Cart: ${centsToPayPalString(rules?.cart_max_cents ?? 0)}</span>
                  <span>•</span>
                  <span>Appr: ${centsToPayPalString(rules?.approval_threshold_cents ?? 0)}</span>
                </div>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
