"use client";

import { useState } from "react";
import { AlertOctagon, CheckCircle2, Loader2 } from "lucide-react";

interface KillSwitchBannerProps {
  initialKillSwitch?: boolean;
  onToggled?: (state: boolean) => void;
}

export function KillSwitchBanner({
  initialKillSwitch = false,
  onToggled,
}: KillSwitchBannerProps) {
  const [killSwitch, setKillSwitch] = useState(initialKillSwitch);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const nextState = !killSwitch;
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitch: nextState }),
      });
      if (res.ok) {
        setKillSwitch(nextState);
        onToggled?.(nextState);
      } else {
        alert("Failed to toggle kill switch. Check connection.");
      }
    } catch (err) {
      console.error(err);
      alert("Error toggling emergency kill switch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Emergency Kill Switch Panel"
      className={`rounded-card border p-4 transition-colors duration-standard ${
        killSwitch
          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          : "bg-surface border-border text-ink"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              killSwitch
                ? "bg-red-600 text-white animate-pulse"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            }`}
          >
            {killSwitch ? (
              <AlertOctagon className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-status-allow" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">
                Emergency Kill Switch:
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  killSwitch
                    ? "bg-red-600 text-white"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {killSwitch ? "ARMED — ALL EVALUATIONS DENIED" : "DISARMED — NORMAL"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {killSwitch
                ? "All agent spending requests are immediately rejected by the deterministic engine with KILL_SWITCH_ON."
                : "Normal policy guardrails active. Toggle ON to halt all agent purchasing across this workspace instantly."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`px-4 py-2 rounded-input text-xs font-bold transition-colors shrink-0 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            killSwitch
              ? "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500"
              : "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
          } disabled:opacity-50`}
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{killSwitch ? "Disarm Kill Switch" : "ENGAGE KILL SWITCH"}</span>
        </button>
      </div>
    </div>
  );
}
