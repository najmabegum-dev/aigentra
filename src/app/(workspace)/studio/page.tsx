import { LayoutDashboard } from "lucide-react";

export default function StudioPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" />
          Control Tower (AG Studio)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time telemetry, transaction flows, and immutable ledger verification.
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-8 text-center text-muted-foreground text-sm">
        Control Tower initialized. Ledger chain head active.
      </div>
    </div>
  );
}
