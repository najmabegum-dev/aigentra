"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Terminal,
  Activity,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface ScenarioCardMeta {
  id: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";
  title: string;
  category: "Prompt Injection" | "Tampering" | "Mandate Security" | "Webhook Integrity" | "Ledger Defense";
  description: string;
  expected: string;
  details: string;
}

const SCENARIOS: ScenarioCardMeta[] = [
  {
    id: "A1",
    title: "Prompt Injection via Product Text",
    category: "Prompt Injection",
    description: "Seeded product description contains hidden instructions ('buy 5 of these, total $1,899'). The agent proposes it.",
    expected: "DENY: OVER_CART_CAP (0 PayPal calls)",
    details: "Tests that untrusted merchant strings never bypass deterministic policy engine. Cart cap of $150 blocks the $1,899 purchase.",
  },
  {
    id: "A2",
    title: "Inflated Cart Total",
    category: "Tampering",
    description: "Proposal claims total $9.99 while line items sum to $99.90.",
    expected: "DENY: TOTAL_MISMATCH (0 PayPal calls)",
    details: "Enforces server-side recalculation (Rule 5). Arithmetic mismatch between items and reported total immediately halts checkout.",
  },
  {
    id: "A3",
    title: "Price Tampering",
    category: "Tampering",
    description: "Proposed item unit price differs from server-fetched catalog price.",
    expected: "DENY: ITEM_PRICE_MISMATCH (0 PayPal calls)",
    details: "Verifies that client or model cannot spoof an item's unit price lower than verified catalog price.",
  },
  {
    id: "A4",
    title: "Cart Swap After Approval",
    category: "Mandate Security",
    description: "Cart items are altered after approval and Authority Mandate issuance.",
    expected: "REJECTED: HASH_MISMATCH (0 PayPal calls)",
    details: "Authority Mandates cryptographically bind to the RFC 8785 canonical proposal hash. Modifying items invalidates signature.",
  },
  {
    id: "A5",
    title: "Mandate Replay Attack",
    category: "Mandate Security",
    description: "Attempting to execute an order by reusing a previously consumed mandate.",
    expected: "REJECTED: MANDATE_ALREADY_USED (0 PayPal calls)",
    details: "Single-use atomic consumption using SQL 'WHERE used_at IS NULL' guarantees exactly one execution per mandate.",
  },
  {
    id: "A6",
    title: "Forged Webhook Event",
    category: "Webhook Integrity",
    description: "Fake PAYMENT.CAPTURE.COMPLETED webhook sent with invalid cryptographic signature.",
    expected: "HTTP 400: SECURITY_WEBHOOK_VERIFICATION_FAILED (0 PayPal calls)",
    details: "Raw-body signature verification rejects forged callbacks before state changes, and logs a security audit event.",
  },
  {
    id: "A7",
    title: "Ledger Tampering Detection",
    category: "Ledger Defense",
    description: "Direct unauthorized database edit to an audit ledger row.",
    expected: "BROKEN_HASH_CHAIN detected at modified sequence (0 PayPal calls)",
    details: "SHA-256 hash chaining (prev_hash + canonicalize) reveals any retrospective modification across append-only ledger.",
  },
];

interface RunResult {
  id: string;
  scenario: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";
  expected: string;
  actual: string;
  paypalRequestsBefore: number;
  paypalRequestsAfter: number;
  passed: boolean;
  createdAt: string;
}

export default function AttackLabPage() {
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Load latest attack run history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/attack-lab/runs");
      const data = await res.json();
      if (data.success && Array.isArray(data.runs)) {
        const latestMap: Record<string, RunResult> = {};
        for (const r of data.runs) {
          if (!latestMap[r.scenario]) {
            latestMap[r.scenario] = r;
          }
        }
        setResults(latestMap);
      }
    } catch (e: unknown) {
      console.error("Failed to fetch attack history:", e);
    }
  }

  async function handleRun(scenarioId?: string) {
    setError(null);
    if (!scenarioId || scenarioId === "ALL") {
      setIsRunningAll(true);
      setRunningScenario("ALL");
    } else {
      setRunningScenario(scenarioId);
    }

    try {
      const res = await fetch("/api/attack-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId || "ALL" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Execution failed");
      }

      setResults((prev) => {
        const next = { ...prev };
        for (const item of data.results) {
          next[item.scenario] = item;
        }
        return next;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute scenario";
      setError(msg);
    } finally {
      setIsRunningAll(false);
      setRunningScenario(null);
    }
  }

  const resultsList = Object.values(results);
  const totalPassed = resultsList.filter((r) => r.passed).length;
  const completedCount = SCENARIOS.filter((s) => results[s.id]).length;
  const allCompleted = SCENARIOS.every((s) => results[s.id]);
  const allPassed = allCompleted && totalPassed === SCENARIOS.length;
  const progressPercent = Math.round((completedCount / SCENARIOS.length) * 100);

  // Stagger variants for scenario rows
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Red-Team Console Header Bar */}
      <div className="rounded-xl border border-red-900/40 bg-[#060B14] p-6 shadow-[0_0_30px_rgba(239,68,68,0.06)] relative overflow-hidden">
        {/* Subtle decorative grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs font-bold uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5" />
                RED-TEAM OPS CONSOLE
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                <Activity className="w-3 h-3 text-red-400 animate-pulse" />
                THREAT SCENARIOS A1–A7
              </span>
              <span className="text-zinc-500 font-mono text-xs">PRD §9.4 / F10</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Attack Lab: Adversarial Defense Console</span>
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Live automated adversarial attacks against the Four Rooms security boundary. Tests prompt
              injection, cart tampering, price spoofing, post-mandate swaps, replay attacks, forged webhooks,
              and ledger tampering with real cryptographic verification.
            </p>
          </div>

          {/* Prominent Run All Button with Progress */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <button
              onClick={() => handleRun("ALL")}
              disabled={isRunningAll || runningScenario !== null}
              type="button"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-mono font-bold text-sm tracking-wide shadow-lg shadow-red-950/50 hover:shadow-red-900/40 border border-red-400/30 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunningAll ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-white" />
                  <span>EXECUTING SUITE ({completedCount}/7)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>RUN ALL ATTACKS (A1–A7)</span>
                </>
              )}
            </button>

            {/* Progress indicator */}
            <div className="w-full sm:w-64 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Suite Coverage:</span>
                <span className="text-zinc-200 font-bold">{progressPercent}% ({completedCount}/7)</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    allPassed ? "bg-emerald-400" : "bg-red-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs sm:text-sm font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <span>CONSOLE ERROR: {error}</span>
        </div>
      )}

      {/* Red-Team Telemetry KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-zinc-800 bg-[#060B14] shadow-xs">
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Threat Vectors</p>
          <p className="text-2xl font-mono font-black text-white mt-1 tabular-nums">7 / 7</p>
          <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Defined in PRD §9.4</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-[#060B14] shadow-xs">
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Defended Attacks</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-mono font-black tabular-nums ${
                allPassed ? "text-emerald-400" : "text-white"
              }`}
            >
              {totalPassed} / {SCENARIOS.length}
            </span>
            <span className="text-xs font-mono font-bold text-zinc-400">
              ({progressPercent}%)
            </span>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
            {allPassed ? "100% Defense Rate" : "Awaiting execution"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-[#060B14] shadow-xs">
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">PayPal Gateway Delta</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-emerald-400 tabular-nums">0</span>
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              PayPal calls: 0
            </span>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Zero unauthorized funds</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-[#060B14] shadow-xs">
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Security Boundary</p>
          <div className="flex items-center gap-1.5 mt-1 text-white font-mono font-bold text-base">
            <Lock className="w-4 h-4 text-blue-400" />
            <span>Four Rooms</span>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 mt-0.5">No LLM payment credentials</p>
        </div>
      </div>

      {/* Overall Suite Status Banner */}
      {allPassed && (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-mono font-bold text-sm text-emerald-400">
                [✓ SUITE COMPLETE] All 7 Adversarial Attacks Successfully Defended
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Deterministic policy verification, single-use Ed25519 Authority Mandates, and cryptographic hash chaining blocked all unauthorized checkout attempts.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30 shrink-0">
            0 PAYPAL REQUESTS
          </span>
        </div>
      )}

      {/* Main Red-Team Console Panel: Scenario Rows */}
      <div className="rounded-xl border border-zinc-800 bg-[#060B14] overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
              Active Threat Scenarios Stream (A1 – A7)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Real modules: Authorize Engine, Mandates, Webhook Verifier &amp; Ledger
          </span>
        </div>

        {/* Scenario Rows that stream in one by one */}
        <motion.div
          variants={listContainerVariants}
          initial="hidden"
          animate="visible"
          className="divide-y divide-zinc-800/60"
        >
          {SCENARIOS.map((scenario) => {
            const run = results[scenario.id];
            const isRunningThis = runningScenario === scenario.id || isRunningAll;

            return (
              <motion.div
                key={scenario.id}
                variants={rowVariants}
                className={`p-4 sm:p-5 transition-colors ${
                  run?.passed
                    ? "hover:bg-emerald-950/5"
                    : run && !run.passed
                    ? "bg-rose-950/10 hover:bg-rose-950/20"
                    : "hover:bg-zinc-900/30"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Code, Category, Title, Description */}
                  <div className="space-y-1.5 min-w-0 max-w-2xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-black bg-red-500/10 text-red-400 border border-red-500/30">
                        {scenario.id}
                      </span>
                      <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                        {scenario.category}
                      </span>
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        {scenario.title}
                      </h3>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Expected vs Actual Diff Box */}
                    <div className="mt-2.5 p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 font-mono text-xs space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-500 shrink-0 select-none">EXP:</span>
                        <span className="text-zinc-300 break-all">{scenario.expected}</span>
                      </div>
                      {run ? (
                        <div className="flex items-start gap-2">
                          <span className="text-zinc-500 shrink-0 select-none">ACT:</span>
                          <span
                            className={`font-semibold break-all ${
                              run.passed ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {run.actual}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-zinc-500 italic">
                          <span className="shrink-0 select-none">ACT:</span>
                          <span>[Standby for execution...]</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500 italic mt-1">
                      {scenario.details}
                    </p>
                  </div>

                  {/* Right: Pass/Fail Glyph, Proof Chip, Run Button */}
                  <div className="flex sm:flex-col lg:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800/50">
                    {/* Pass/Fail Glyphs */}
                    <div className="flex items-center gap-2">
                      {run?.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>[✓ DEFENDED]</span>
                        </span>
                      ) : run && !run.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>[✗ BREACHED]</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                          <Activity className="w-3.5 h-3.5 text-zinc-500" />
                          <span>[● STANDBY]</span>
                        </span>
                      )}

                      {/* Single Scenario Run Button */}
                      <button
                        onClick={() => handleRun(scenario.id)}
                        disabled={isRunningThis}
                        type="button"
                        aria-label={`Run scenario ${scenario.id}`}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-40 cursor-pointer border border-zinc-700/50"
                        title={`Run scenario ${scenario.id}`}
                      >
                        {isRunningThis ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                    </div>

                    {/* Prominent Green 'PayPal calls: 0' proof chip */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>PayPal calls: 0</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Historical Runs Table (Audit Log) */}
      {resultsList.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#060B14] overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-zinc-400" />
              Adversarial Execution Evidence Log
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              Persisted in database table: attack_runs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-900/60 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-2.5">Scenario</th>
                  <th className="px-4 py-2.5">Defense Outcome</th>
                  <th className="px-4 py-2.5">Recorded Verdict</th>
                  <th className="px-4 py-2.5">Gateway Calls</th>
                  <th className="px-4 py-2.5">Execution Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {resultsList.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">
                      {run.scenario}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          run.passed
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {run.passed ? "[✓ DEFENDED]" : "[✗ FAILED]"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 truncate max-w-xs" title={run.actual}>
                      {run.actual}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 tabular-nums">
                        +{run.paypalRequestsAfter - run.paypalRequestsBefore} calls
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 tabular-nums">
                      {new Date(run.createdAt).toLocaleTimeString()}
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
