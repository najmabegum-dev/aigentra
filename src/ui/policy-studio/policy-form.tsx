"use client";

import { useState, useEffect } from "react";
import {
  Save,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import type { PolicyRuleDefinition, MerchantMode, PolicyStatus } from "@/rooms/authorize/types";
import { policyFormSchema, parseMerchantsInput } from "@/lib/policies";
import { centsToPayPalString } from "@/lib/money";

const AVAILABLE_CATEGORIES = [
  "gift_cards",
  "gambling",
  "weapons",
  "alcohol",
  "adult",
  "crypto",
  "subscription",
  "luxury",
];

interface PolicyFormProps {
  initialRules?: PolicyRuleDefinition;
  policyId?: string;
  isNew?: boolean;
  onSaved: (policy: unknown) => void;
  onRulesChanged?: (rules: PolicyRuleDefinition) => void;
  onStatusChanged?: (newStatus: PolicyStatus) => void;
}

export function PolicyForm({
  initialRules,
  policyId,
  isNew = false,
  onSaved,
  onRulesChanged,
  onStatusChanged,
}: PolicyFormProps) {
  const [name, setName] = useState(initialRules?.name || "Home Office Guardrails");
  const [perItemMax, setPerItemMax] = useState(
    initialRules ? (initialRules.per_item_max_cents / 100).toString() : "120"
  );
  const [cartMax, setCartMax] = useState(
    initialRules ? (initialRules.cart_max_cents / 100).toString() : "150"
  );
  const [approvalThreshold, setApprovalThreshold] = useState(
    initialRules ? (initialRules.approval_threshold_cents / 100).toString() : "50"
  );
  const [dailyCap, setDailyCap] = useState(
    initialRules ? (initialRules.daily_cap_cents / 100).toString() : "200"
  );
  const [merchantMode, setMerchantMode] = useState<MerchantMode>(
    initialRules?.merchant_mode || "DENYLIST"
  );
  const [merchantsText, setMerchantsText] = useState(
    initialRules?.merchants ? initialRules.merchants.join("\n") : "sketchy-deals.com\ngambling-gear.com"
  );
  const [blockedCategories, setBlockedCategories] = useState<string[]>(
    initialRules?.blocked_categories || ["gift_cards", "gambling", "weapons"]
  );
  const [velocityMinutes, setVelocityMinutes] = useState(
    initialRules?.velocity_minutes?.toString() || "10"
  );
  const [priceMaxAge, setPriceMaxAge] = useState(
    initialRules?.price_max_age_seconds?.toString() || "300"
  );
  const [expiresAt, setExpiresAt] = useState(() => {
    if (initialRules?.expires_at) {
      return new Date(initialRules.expires_at).toISOString().slice(0, 10);
    }
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [status, setStatus] = useState<PolicyStatus>(initialRules?.status || "ACTIVE");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Synchronize initial rules when switching selected version
  useEffect(() => {
    if (initialRules) {
      setName(initialRules.name || "Untitled Policy");
      setPerItemMax((initialRules.per_item_max_cents / 100).toString());
      setCartMax((initialRules.cart_max_cents / 100).toString());
      setApprovalThreshold((initialRules.approval_threshold_cents / 100).toString());
      setDailyCap((initialRules.daily_cap_cents / 100).toString());
      setMerchantMode(initialRules.merchant_mode);
      setMerchantsText(initialRules.merchants.join("\n"));
      setBlockedCategories(initialRules.blocked_categories || []);
      setVelocityMinutes(initialRules.velocity_minutes.toString());
      setPriceMaxAge(initialRules.price_max_age_seconds.toString());
      setStatus(initialRules.status);
      if (initialRules.expires_at) {
        setExpiresAt(new Date(initialRules.expires_at).toISOString().slice(0, 10));
      }
    }
  }, [initialRules]);

  // Compute live parsed rules and emit for live preview
  useEffect(() => {
    const rawData = {
      name,
      currency: "USD",
      per_item_max: parseFloat(perItemMax) || 0,
      cart_max: parseFloat(cartMax) || 0,
      approval_threshold: parseFloat(approvalThreshold) || 0,
      daily_cap: parseFloat(dailyCap) || 0,
      merchant_mode: merchantMode,
      merchants: merchantsText,
      blocked_categories: blockedCategories,
      velocity_minutes: parseInt(velocityMinutes, 10) || 0,
      price_max_age_seconds: parseInt(priceMaxAge, 10) || 0,
      valid_from: initialRules?.valid_from || new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      status,
      timezone: "Asia/Kolkata",
    };

    const parsed = policyFormSchema.safeParse(rawData);
    if (parsed.success) {
      setErrors({});
      onRulesChanged?.(parsed.data);
    } else {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const key = err.path[0]?.toString() || "form";
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
    }
  }, [
    name,
    perItemMax,
    cartMax,
    approvalThreshold,
    dailyCap,
    merchantMode,
    merchantsText,
    blockedCategories,
    velocityMinutes,
    priceMaxAge,
    expiresAt,
    status,
    initialRules?.valid_from,
    onRulesChanged,
  ]);

  const toggleCategory = (cat: string) => {
    setBlockedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawData = {
      name,
      currency: "USD",
      per_item_max: parseFloat(perItemMax) || 0,
      cart_max: parseFloat(cartMax) || 0,
      approval_threshold: parseFloat(approvalThreshold) || 0,
      daily_cap: parseFloat(dailyCap) || 0,
      merchant_mode: merchantMode,
      merchants: merchantsText,
      blocked_categories: blockedCategories,
      velocity_minutes: parseInt(velocityMinutes, 10) || 0,
      price_max_age_seconds: parseInt(priceMaxAge, 10) || 0,
      valid_from: initialRules?.valid_from || new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      status,
      timezone: "Asia/Kolkata",
    };

    const validation = policyFormSchema.safeParse(rawData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const key = err.path[0]?.toString() || "form";
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const url = isNew || !policyId ? "/api/policies" : `/api/policies/${policyId}`;
      const method = isNew || !policyId ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }

      onSaved(data);
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to save policy version");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (targetStatus: PolicyStatus) => {
    if (!policyId) return;
    if (targetStatus === "REVOKED" && !confirm("Are you sure you want to REVOKE this policy? Revoked policies are terminal and cannot be reactivated.")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status update failed");

      setStatus(targetStatus);
      onStatusChanged?.(targetStatus);
      onSaved(data);
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setActionLoading(false);
    }
  };

  const isRevoked = status === "REVOKED";

  return (
    <form onSubmit={handleSave} className="rounded-card border border-border bg-surface p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-ink">
            {isNew ? "Configure New Guardrail Policy" : "Edit Guardrail Limits"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Material changes automatically append a new immutable version.
          </p>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {status === "DRAFT" && (
            <button
              type="button"
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={actionLoading || isRevoked}
              className="px-3 py-1.5 rounded-input bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Activate</span>
            </button>
          )}

          {status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => handleStatusChange("PAUSED")}
              disabled={actionLoading || isRevoked}
              className="px-3 py-1.5 rounded-input bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {status === "PAUSED" && (
            <button
              type="button"
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={actionLoading || isRevoked}
              className="px-3 py-1.5 rounded-input bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          )}

          {!isRevoked && (
            <button
              type="button"
              onClick={() => handleStatusChange("REVOKED")}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-input border border-red-300 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Revoke</span>
            </button>
          )}

          {isRevoked && (
            <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-mono font-bold text-xs uppercase">
              Revoked (Terminal)
            </span>
          )}
        </div>
      </div>

      {/* Policy Name & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-ink">Policy Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g. Home Office Guardrails"
          />
          {errors.name && <p className="text-[11px] text-status-deny">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Currency</label>
          <input
            type="text"
            value="USD (Sandbox Only)"
            disabled
            className="w-full px-3 py-2 rounded-input border border-border bg-muted text-muted-foreground text-sm font-mono"
          />
        </div>
      </div>

      {/* Spend Limits Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Cart Maximum ($ USD)</label>
          <input
            type="number"
            step="0.01"
            value={cartMax}
            onChange={(e) => setCartMax(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Hard cap. Carts above are rejected.</span>
          {errors.cart_max && <p className="text-[11px] text-status-deny">{errors.cart_max}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Approval Threshold ($ USD)</label>
          <input
            type="number"
            step="0.01"
            value={approvalThreshold}
            onChange={(e) => setApprovalThreshold(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Carts above require human biometric approval.</span>
          {errors.approval_threshold && (
            <p className="text-[11px] text-status-deny">{errors.approval_threshold}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Per-Item Limit ($ USD)</label>
          <input
            type="number"
            step="0.01"
            value={perItemMax}
            onChange={(e) => setPerItemMax(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Max unit price for any single line item.</span>
          {errors.per_item_max && (
            <p className="text-[11px] text-status-deny">{errors.per_item_max}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Daily Spend Cap ($ USD)</label>
          <input
            type="number"
            step="0.01"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Rolling 24hr calendar day cumulative total.</span>
          {errors.daily_cap && <p className="text-[11px] text-status-deny">{errors.daily_cap}</p>}
        </div>
      </div>

      {/* Merchant Mode & Domain List */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Merchant Mode</label>
            <select
              value={merchantMode}
              onChange={(e) => setMerchantMode(e.target.value as MerchantMode)}
              disabled={isRevoked}
              className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="DENYLIST">DENYLIST (Block specific)</option>
              <option value="ALLOWLIST_ONLY">ALLOWLIST_ONLY (Explicit permit)</option>
              <option value="ANY_WITH_APPROVAL">ANY_WITH_APPROVAL (Require sign-off)</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink">
                Merchant Domains ({merchantMode === "DENYLIST" ? "Denylisted" : "Allowlisted"})
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {parseMerchantsInput(merchantsText).length} normalized
              </span>
            </div>
            <textarea
              rows={3}
              value={merchantsText}
              onChange={(e) => setMerchantsText(e.target.value)}
              disabled={isRevoked}
              placeholder="e.g. sketchy-deals.com&#10;fraudulent-site.org"
              className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Blocked Categories Tag Selection */}
      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-xs font-semibold text-ink block">
          Blocked Categories Vocabulary
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_CATEGORIES.map((cat) => {
            const isBlocked = blockedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => !isRevoked && toggleCategory(cat)}
                disabled={isRevoked}
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors flex items-center gap-1 ${
                  isBlocked
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-900"
                    : "bg-muted text-muted-foreground border-border hover:text-ink"
                }`}
              >
                <span>{cat}</span>
                {isBlocked ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Velocity, Stale Price & Expiry */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Velocity Window (Minutes)</label>
          <input
            type="number"
            value={velocityMinutes}
            onChange={(e) => setVelocityMinutes(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Duplicate SKU cooldown</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Price Freshness (Seconds)</label>
          <input
            type="number"
            value={priceMaxAge}
            onChange={(e) => setPriceMaxAge(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Stale price threshold</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Policy Expiration Date</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isRevoked}
            className="w-full px-3 py-2 rounded-input border border-border bg-background text-ink text-xs focus:ring-2 focus:ring-primary focus:outline-none"
          />
          {errors.expires_at && <p className="text-[11px] text-status-deny">{errors.expires_at}</p>}
        </div>
      </div>

      {/* Submit / Save Button */}
      <div className="pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {Object.keys(errors).length > 0 && (
            <span className="flex items-center gap-1 text-status-deny font-medium">
              <AlertCircle className="w-4 h-4" />
              Please fix configuration errors before saving.
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || isRevoked || Object.keys(errors).length > 0}
          className="px-5 py-2.5 rounded-input bg-primary hover:bg-blue-600 text-white font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isNew ? "Create Policy Version 1" : "Save as New Immutable Version"}</span>
        </button>
      </div>
    </form>
  );
}
