import { CheckCircle2 } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-status-approval" />
          Approval Centre
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending proposals requiring human authorization before single-use mandate issuance.
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-8 text-center text-muted-foreground text-sm">
        No pending approval requests in queue. Proposals exceeding the $50.00 threshold will appear here.
      </div>
    </div>
  );
}
