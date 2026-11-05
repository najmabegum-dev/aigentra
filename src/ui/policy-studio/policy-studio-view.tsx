"use client";

import { useState } from "react";
import { Shield, Plus, AlertTriangle, CheckCircle, PauseCircle } from "lucide-react";
import type { PolicyRuleDefinition, PolicyStatus } from "@/rooms/authorize/types";
import { KillSwitchBanner } from "./kill-switch-banner";
import { PolicyForm } from "./policy-form";
import { LivePreview } from "./live-preview";
import { VersionHistory, type VersionItem } from "./version-history";

export interface PolicyData {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: VersionItem | null;
  versions: VersionItem[];
}

interface PolicyStudioViewProps {
  initialPolicies: PolicyData[];
  initialKillSwitch?: boolean;
}

export function PolicyStudioView({
  initialPolicies,
  initialKillSwitch = false,
}: PolicyStudioViewProps) {
  const [policies, setPolicies] = useState<PolicyData[]>(initialPolicies);
  const [selectedPolicyIndex, setSelectedPolicyIndex] = useState(0);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const currentPolicy = policies[selectedPolicyIndex] || null;
  const currentVersions = currentPolicy?.versions || [];
  const latestRules = (currentPolicy?.latestVersion?.rulesJson as PolicyRuleDefinition) || null;

  // Track version selected in history list (defaults to latest version number)
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(
    currentPolicy?.latestVersion?.version ?? 1
  );

  // Live preview state: updates as user types in form
  const [previewRules, setPreviewRules] = useState<PolicyRuleDefinition | null>(latestRules);

  const isHistorical =
    currentPolicy?.latestVersion?.version !== undefined &&
    selectedVersionNum !== currentPolicy?.latestVersion?.version;

  const handleSaved = (data: unknown) => {
    // Refresh page / state
    window.location.reload();
  };

  const handleSelectVersion = (vNum: number) => {
    setSelectedVersionNum(vNum);
    const selectedVersion = currentVersions.find((v) => v.version === vNum);
    if (selectedVersion) {
      setPreviewRules(selectedVersion.rulesJson as PolicyRuleDefinition);
    }
  };

  const currentStatus = (previewRules?.status || latestRules?.status || "DRAFT") as PolicyStatus;

  return (
    <div className="space-y-6">
      {/* Top Header & Emergency Kill Switch */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Policy Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure deterministic limits and authorization thresholds for AI agent purchasing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isCreatingNew && (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(true);
                  setPreviewRules(null);
                }}
                className="px-3.5 py-1.5 rounded-input bg-primary text-white hover:bg-blue-600 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Policy</span>
              </button>
            )}
            {isCreatingNew && (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setPreviewRules(latestRules);
                }}
                className="px-3 py-1.5 rounded-input border border-border bg-surface text-ink hover:bg-muted text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Persistent Emergency Kill Switch */}
        <KillSwitchBanner initialKillSwitch={initialKillSwitch} />
      </div>

      {/* State Indicators (Active / Paused / Draft / Revoked) */}
      {!isCreatingNew && currentPolicy && (
        <div className="flex items-center gap-3">
          {currentStatus === "ACTIVE" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-status-allow border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5 text-status-allow" />
              <span>ACTIVE — Guarding live proposals</span>
            </div>
          )}

          {currentStatus === "PAUSED" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-status-approval border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <PauseCircle className="w-3.5 h-3.5 text-status-approval" />
              <span>PAUSED — All evaluations temporarily rejected</span>
            </div>
          )}

          {currentStatus === "DRAFT" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
              <span>DRAFT — Inactive until user confirms activation</span>
            </div>
          )}

          {currentStatus === "REVOKED" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-status-deny border border-red-200 dark:bg-red-950 dark:border-red-800">
              <AlertTriangle className="w-3.5 h-3.5 text-status-deny" />
              <span>REVOKED — Terminal state (read-only)</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {policies.length === 0 && !isCreatingNew ? (
        <div className="rounded-card border border-border bg-surface p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-primary mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-ink">No Policies Configured</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Your workspace currently has no active guardrails. Create a policy to establish bounded purchasing limits for your agent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="px-4 py-2 rounded-input bg-primary hover:bg-blue-600 text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Guardrail Policy</span>
          </button>
        </div>
      ) : (
        /* Form on the left, live preview on the right (PRD 10.2) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <PolicyForm
              key={isCreatingNew ? "new" : currentPolicy?.id}
              initialRules={isCreatingNew ? undefined : latestRules || undefined}
              policyId={isCreatingNew ? undefined : currentPolicy?.id}
              isNew={isCreatingNew}
              onSaved={handleSaved}
              onRulesChanged={(rules) => setPreviewRules(rules)}
            />
          </div>

          {/* Right Column: Live Preview & Version History (5 cols) */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            {previewRules && (
              <LivePreview
                rules={previewRules}
                isHistorical={isHistorical}
                versionNumber={selectedVersionNum}
              />
            )}

            {!isCreatingNew && currentVersions.length > 0 && (
              <VersionHistory
                versions={currentVersions}
                selectedVersionNumber={selectedVersionNum}
                onSelectVersion={handleSelectVersion}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
