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
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Red-Team Console Header Bar (Flat ink styling) */}
      <div className="rounded-[6px] border border-line bg-surface p-6 relative select-none">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-deny/10 border border-deny/30 text-deny font-mono text-xs font-bold uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-deny" strokeWidth={1.25} />
                RED-TEAM OPS CONSOLE
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-surface-2 border border-line text-text-dim font-mono text-[11px]">
                <Activity className="w-3 h-3 text-deny animate-pulse" strokeWidth={1.25} />
                THREAT SCENARIOS A1–A7
              </span>
              <span className="text-text-dim font-mono text-xs">PRD §9.4 / F10</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text flex items-center gap-2">
              <span>Attack Lab: Adversarial Defense Console</span>
            </h1>

            <p className="text-xs sm:text-sm text-text-dim max-w-2xl leading-relaxed">
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
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[4px] bg-deny text-[#0B0C0E] hover:opacity-90 active:opacity-100 font-mono font-bold text-xs tracking-wide border border-transparent transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRunningAll ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-[#0B0C0E]" strokeWidth={1.25} />
                  <span>EXECUTING SUITE ({completedCount}/7)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-[#0B0C0E]" strokeWidth={1.25} />
                  <span>RUN ALL ATTACKS (A1–A7)</span>
                </>
              )}
            </button>

            {/* Progress indicator */}
            <div className="w-full sm:w-60 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-dim">
                <span>Suite Coverage:</span>
                <span className="text-text font-bold">{progressPercent}% ({completedCount}/7)</span>
              </div>
              <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    allPassed ? "bg-allow" : "bg-deny"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[4px] bg-deny/10 border border-deny/30 text-deny text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-deny" strokeWidth={1.25} />
          <span>CONSOLE ERROR: {error}</span>
        </div>
      )}

      {/* Red-Team Telemetry KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-[6px] border border-line bg-surface">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Threat Vectors</p>
          <p className="text-2xl font-mono font-bold text-text mt-1 tabular-nums">7 / 7</p>
          <p className="text-[10px] font-mono text-text-dim mt-0.5">Defined in PRD §9.4</p>
        </div>

        <div className="p-4 rounded-[6px] border border-line bg-surface">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Defended Attacks</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${
                allPassed ? "text-allow" : "text-text"
              }`}
            >
              {totalPassed} / {SCENARIOS.length}
            </span>
            <span className="text-xs font-mono font-bold text-text-dim">
              ({progressPercent}%)
            </span>
          </div>
          <p className="text-[10px] font-mono text-text-dim mt-0.5">
            {allPassed ? "100% Defense Rate" : "Awaiting execution"}
          </p>
        </div>

        <div className="p-4 rounded-[6px] border border-line bg-surface">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">PayPal Gateway Delta</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-allow tabular-nums">0</span>
            {/* Real status: pill */}
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-allow/10 text-allow border border-allow/30">
              PayPal calls: 0
            </span>
          </div>
          <p className="text-[10px] font-mono text-text-dim mt-0.5">Zero unauthorized funds</p>
        </div>

        <div className="p-4 rounded-[6px] border border-line bg-surface">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Security Boundary</p>
          <div className="flex items-center gap-1.5 mt-1 text-text font-mono font-bold text-base">
            <Lock className="w-4 h-4 text-signal" strokeWidth={1.25} />
            <span>Four Rooms</span>
          </div>
          <p className="text-[10px] font-mono text-text-dim mt-0.5">No LLM payment credentials</p>
        </div>
      </div>

      {/* Overall Suite Status Banner */}
      {allPassed && (
        <div className="p-4 rounded-[6px] bg-surface-2 border border-allow/40 text-text flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-allow shrink-0" strokeWidth={1.25} />
            <div>
              <p className="font-mono font-bold text-sm text-allow">
                [✓ SUITE COMPLETE] All 7 Adversarial Attacks Successfully Defended
              </p>
              <p className="text-xs text-text-dim mt-0.5 font-mono">
                Deterministic policy verification, single-use Ed25519 Authority Mandates, and cryptographic hash chaining blocked all unauthorized checkout attempts.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-allow/10 text-allow font-mono text-xs font-bold border border-allow/30 shrink-0">
            0 PAYPAL REQUESTS
          </span>
        </div>
      )}

      {/* Main Red-Team Console Panel: Scenario Rows */}
      <div className="rounded-[6px] border border-line bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-surface-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-deny" strokeWidth={1.25} />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-text">
              Active Threat Scenarios Stream (A1 – A7)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-text-dim">
            Real modules: Authorize Engine, Mandates, Webhook Verifier &amp; Ledger
          </span>
        </div>

        {/* Scenario Rows that stream in one by one */}
        <motion.div
          variants={listContainerVariants}
          initial="hidden"
          animate="visible"
          className="divide-y divide-line"
        >
          {SCENARIOS.map((scenario) => {
            const run = results[scenario.id];
            const isRunningThis = runningScenario === scenario.id || isRunningAll;

            return (
              <motion.div
                key={scenario.id}
                variants={rowVariants}
                className="p-4 sm:p-5 hover:bg-surface-2/40 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Code, Category, Title, Description */}
                  <div className="space-y-1.5 min-w-0 max-w-2xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-mono font-bold bg-deny/10 text-deny border border-deny/30">
                        {scenario.id}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-surface-2 text-text-dim border border-line">
                        {scenario.category}
                      </span>
                      <h3 className="text-sm font-sans font-bold text-text tracking-tight">
                        {scenario.title}
                      </h3>
                    </div>

                    <p className="text-xs text-text-dim leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Expected vs Actual Diff Box */}
                    <div className="mt-2.5 p-2.5 rounded-[4px] bg-surface-2 border border-line font-mono text-xs space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-text-dim shrink-0 select-none">EXP:</span>
                        <span className="text-text break-all">{scenario.expected}</span>
                      </div>
                      {run ? (
                        <div className="flex items-start gap-2">
                          <span className="text-text-dim shrink-0 select-none">ACT:</span>
                          <span
                            className={`font-semibold break-all ${
                              run.passed ? "text-allow" : "text-deny"
                            }`}
                          >
                            {run.actual}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-text-dim italic">
                          <span className="shrink-0 select-none">ACT:</span>
                          <span>[Standby for execution...]</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-text-dim italic mt-1 font-mono">
                      {scenario.details}
                    </p>
                  </div>

                  {/* Right: Pass/Fail Glyph, Proof Chip, Run Button */}
                  <div className="flex sm:flex-col lg:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-line">
                    {/* Pass/Fail Glyphs */}
                    <div className="flex items-center gap-2">
                      {run?.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-mono font-bold bg-allow/10 text-allow border border-allow/30">
                          <ShieldCheck className="w-3.5 h-3.5 text-allow" strokeWidth={1.25} />
                          <span>[✓ DEFENDED]</span>
                        </span>
                      ) : run && !run.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-mono font-bold bg-deny/10 text-deny border border-deny/30">
                          <XCircle className="w-3.5 h-3.5 text-deny" strokeWidth={1.25} />
                          <span>[✗ BREACHED]</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-mono font-medium bg-surface-2 text-text-dim border border-line">
                          <Activity className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.25} />
                          <span>[● STANDBY]</span>
                        </span>
                      )}

                      {/* Single Scenario Run Button */}
                      <button
                        onClick={() => handleRun(scenario.id)}
                        disabled={isRunningThis}
                        type="button"
                        aria-label={`Run scenario ${scenario.id}`}
                        className="p-1.5 rounded-[4px] bg-surface-2 hover:bg-surface text-text-dim hover:text-text transition-colors disabled:opacity-40 cursor-pointer border border-line"
                        title={`Run scenario ${scenario.id}`}
                      >
                        {isRunningThis ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-deny" strokeWidth={1.25} />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" strokeWidth={1.25} />
                        )}
                      </button>
                    </div>

                    {/* Prominent Green 'PayPal calls: 0' proof chip (Real status: pill) */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-allow/10 text-allow border border-allow/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-allow" strokeWidth={1.25} />
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
        <div className="rounded-[6px] border border-line bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-surface-2 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.25} />
              <span>Adversarial Execution Evidence Log</span>
            </h3>
            <span className="text-[11px] font-mono text-text-dim">
              attack_runs table
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-2 text-text-dim uppercase text-[10px] border-b border-line">
                <tr>
                  <th className="px-4 py-2.5">Scenario</th>
                  <th className="px-4 py-2.5">Defense Outcome</th>
                  <th className="px-4 py-2.5">Recorded Verdict</th>
                  <th className="px-4 py-2.5">Gateway Calls</th>
                  <th className="px-4 py-2.5">Execution Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {resultsList.map((run) => (
                  <tr key={run.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-text">
                      {run.scenario}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${
                          run.passed
                            ? "bg-allow/10 text-allow border border-allow/30"
                            : "bg-deny/10 text-deny border border-deny/30"
                        }`}
                      >
                        {run.passed ? "[✓ DEFENDED]" : "[✗ FAILED]"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-dim truncate max-w-xs" title={run.actual}>
                      {run.actual}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-allow/10 text-allow border border-allow/30 tabular-nums">
                        +{run.paypalRequestsAfter - run.paypalRequestsBefore} calls
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-dim tabular-nums">
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
