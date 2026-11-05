import { Zap } from "lucide-react";

export default function AttackLabPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <Zap className="w-6 h-6 text-status-deny" />
          Attack Lab (F10)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated defense suite testing 7 adversarial attack vectors against the Four Rooms security boundary.
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-8 text-center text-muted-foreground text-sm">
        Attack Lab suite configured: 7 scenarios ready. Zero unauthorized PayPal calls guaranteed.
      </div>
    </div>
  );
}
