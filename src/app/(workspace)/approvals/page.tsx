import { CheckCircle2 } from "lucide-react";
import { ApprovalCentre } from "@/ui/approvals/ApprovalCentre";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-status-approval" />
          Approval Centre
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending proposals requiring human authorization before single-use mandate issuance (PRD §6.5 & F5).
        </p>
      </div>

      <ApprovalCentre />
    </div>
  );
}
