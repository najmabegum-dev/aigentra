import { cookies } from "next/headers";
import { WORKSPACE_COOKIE_NAME, verifyWorkspaceId } from "@/lib/session";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Shield, ShieldAlert, CheckCircle, Clock } from "lucide-react";
import type { PolicyRuleDefinition } from "@/rooms/authorize/types";

export default async function PoliciesPage() {
  const cookieStore = cookies();
  const rawCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const workspaceId = verifyWorkspaceId(rawCookie);

  if (!workspaceId) {
    return null;
  }

  // Golden Rule 9: Query strictly scoped by workspace_id
  const userPolicies = await db
    .select()
    .from(schema.policies)
    .where(eq(schema.policies.workspaceId, workspaceId))
    .orderBy(desc(schema.policies.createdAt));

  const versions = await db
    .select()
    .from(schema.policyVersions)
    .where(eq(schema.policyVersions.workspaceId, workspaceId))
    .orderBy(desc(schema.policyVersions.version));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Policy Guardrails
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deterministic financial limits and approval boundaries enforced before PayPal execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
            Pure Engine Active
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        {userPolicies.length === 0 ? (
          <div className="rounded-card border border-border p-12 text-center bg-surface">
            <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink">No policies configured</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a policy to configure bounded spending limits.
            </p>
          </div>
        ) : (
          userPolicies.map((p) => {
            const policyVersions = versions.filter((v) => v.policyId === p.id);
            const activeVersion = policyVersions[0];
            const rules = activeVersion?.rulesJson as PolicyRuleDefinition | undefined;

            return (
              <div
                key={p.id}
                className="rounded-card border border-border bg-surface p-6 shadow-sm space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-border">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-ink">
                        {rules?.name || "Untitled Policy"}
                      </h2>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        v{activeVersion?.version ?? 1} (Immutable)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      ID: {p.id}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-status-allow border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 self-start">
                    <CheckCircle className="w-3.5 h-3.5 text-status-allow" />
                    {rules?.status || "ACTIVE"}
                  </span>
                </div>

                {/* Plain-Language Rule Summary */}
                <div className="p-4 rounded-input bg-muted/60 border border-border text-xs leading-relaxed text-ink space-y-1">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Plain-Language Enforcement Summary
                  </div>
                  <p>
                    Autonomous agent purchases are permitted up to{" "}
                    <strong>${((rules?.approval_threshold_cents ?? 0) / 100).toFixed(2)}</strong>.
                    Purchases between{" "}
                    <strong>${((rules?.approval_threshold_cents ?? 0) / 100).toFixed(2)}</strong> and{" "}
                    <strong>${((rules?.cart_max_cents ?? 0) / 100).toFixed(2)}</strong> require human
                    approval. Per-item prices cannot exceed{" "}
                    <strong>${((rules?.per_item_max_cents ?? 0) / 100).toFixed(2)}</strong>, and the daily cap
                    is <strong>${((rules?.daily_cap_cents ?? 0) / 100).toFixed(2)}</strong>.
                  </p>
                </div>

                {/* Limits Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-input bg-surface-raised border border-border">
                    <span className="text-[11px] text-muted-foreground block font-medium">Cart Maximum</span>
                    <span className="text-lg font-bold text-ink font-mono">
                      ${((rules?.cart_max_cents ?? 0) / 100).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Hard DENY if above</span>
                  </div>

                  <div className="p-3 rounded-input bg-surface-raised border border-border">
                    <span className="text-[11px] text-muted-foreground block font-medium">Approval Threshold</span>
                    <span className="text-lg font-bold text-status-approval font-mono">
                      ${((rules?.approval_threshold_cents ?? 0) / 100).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Require human approval</span>
                  </div>

                  <div className="p-3 rounded-input bg-surface-raised border border-border">
                    <span className="text-[11px] text-muted-foreground block font-medium">Per-Item Limit</span>
                    <span className="text-lg font-bold text-ink font-mono">
                      ${((rules?.per_item_max_cents ?? 0) / 100).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Single item cap</span>
                  </div>

                  <div className="p-3 rounded-input bg-surface-raised border border-border">
                    <span className="text-[11px] text-muted-foreground block font-medium">Daily Spend Cap</span>
                    <span className="text-lg font-bold text-ink font-mono">
                      ${((rules?.daily_cap_cents ?? 0) / 100).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Rolling 24hr window</span>
                  </div>
                </div>

                {/* Additional Rules & Merchant Modes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="space-y-1">
                    <span className="font-semibold text-ink">Merchant Mode:</span>
                    <div className="font-mono text-muted-foreground">
                      {rules?.merchant_mode} ({rules?.merchants?.length || 0} blocked)
                    </div>
                    {rules?.merchants && rules.merchants.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rules.merchants.map((m) => (
                          <span
                            key={m}
                            className="px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800 text-[11px] font-mono"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-ink">Blocked Categories:</span>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {rules?.blocked_categories?.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[11px] font-mono"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
