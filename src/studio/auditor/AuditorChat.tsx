"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  Send,
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Info,
  Clock,
  Terminal,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "live" | "replay";
  reason?: string;
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
  timestamp: string;
}

const QUICK_PROMPTS = [
  "Explain why the last proposal was blocked",
  "Audit the latest hash-chained ledger events",
  "Summarize attacks and prompt injections in last 24h",
];

export function AuditorChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to the **AIGENTRA Auditor Agent**. I have **read-only access** to your workspace ledger, policy evaluation records, and blocked authorization attempts.\n\nAsk me to interrogate any decision ID, check hash-chain integrity, or summarize threat activity.",
      mode: "live",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleTool = (key: string) => {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/auditor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Auditor agent request failed");
      }

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: data.message,
        mode: data.mode,
        reason: data.reason,
        toolCalls: data.toolCalls,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `**Auditor Error**: ${err.message || "Failed to contact auditor service."}`,
        mode: "replay",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[620px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Auditor Agent
              </h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Studio Agent Framework
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Read-only oversight · 0 payment capabilities · Golden Rule 1 enforced
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>3 Read-Only Tools</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none shadow-sm"
              }`}
            >
              {/* Role & Mode Header for Assistant */}
              {m.role === "assistant" && (
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AIGENTRA Auditor</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.mode === "replay" ? (
                      <span
                        className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono"
                        title={m.reason || "Replay mode"}
                      >
                        Replay
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                        Live AI
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              )}

              {/* Tool Calls Accordion */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mb-3 space-y-2">
                  {m.toolCalls.map((tc, idx) => {
                    const toolKey = `${m.id}_${idx}`;
                    const isExpanded = !!expandedTools[toolKey];
                    return (
                      <div
                        key={idx}
                        className="rounded bg-slate-900/90 border border-slate-700/70 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTool(toolKey)}
                          className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-300 hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-mono text-emerald-300">
                              {tc.toolName}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              (read-only)
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="p-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 bg-slate-950/60 overflow-x-auto max-h-40">
                            <div className="text-slate-500 mb-1">Arguments:</div>
                            <pre className="text-slate-300">
                              {JSON.stringify(tc.args, null, 2)}
                            </pre>
                            <div className="text-slate-500 mt-2 mb-1">Result:</div>
                            <pre className="text-slate-300">
                              {JSON.stringify(tc.result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Message Content */}
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/40 w-fit">
            <Bot className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Auditing ledger & policy records...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">
          Quick Audit:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60 whitespace-nowrap transition disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Auditor Agent about decisions, ledger hashes, or blocked attempts..."
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}
