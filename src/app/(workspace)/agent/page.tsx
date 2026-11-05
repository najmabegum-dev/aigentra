import { Bot } from "lucide-react";

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          Autonomous Shopping Agent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agent parses buyer intents, queries Channel3 product catalogs, and proposes carts with server-recomputed totals.
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-50 text-primary border border-blue-200">
            Room 1: Propose
          </span>
          <h2 className="text-base font-bold text-ink">Ready for Intent Input</h2>
          <p className="text-xs text-muted-foreground">
            The model suggests items; AIGENTRA computes totals and validates against policy guardrails before any execution can occur.
          </p>
        </div>
      </div>
    </div>
  );
}
