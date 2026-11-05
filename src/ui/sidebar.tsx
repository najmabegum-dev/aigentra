"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Bot,
  CheckCircle2,
  LayoutDashboard,
  Zap,
  Settings,
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  {
    name: "Policies",
    href: "/policies",
    icon: Shield,
    description: "Guardrails & approval limits",
  },
  {
    name: "Agent",
    href: "/agent",
    icon: Bot,
    description: "Autonomous shopper & proposals",
  },
  {
    name: "Approvals",
    href: "/approvals",
    icon: CheckCircle2,
    description: "Authority mandates & queue",
  },
  {
    name: "Control Tower",
    href: "/studio",
    icon: LayoutDashboard,
    description: "AG Studio telemetry & audits",
  },
  {
    name: "Attack Lab",
    href: "/attack-lab",
    icon: Zap,
    description: "Security scenarios & defense suite",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Integrations & kill switch",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Workspace Navigation"
      className="w-64 border-r border-border bg-surface flex flex-col justify-between shrink-0 min-h-[calc(100vh-6rem)]"
    >
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Workspace Modules
        </div>
        <nav className="space-y-1">
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors duration-standard ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-ink hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                <div className="flex flex-col">
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border bg-surface-raised/40">
        <div className="rounded-card border border-border p-3 bg-surface text-xs space-y-1">
          <div className="font-semibold text-ink flex items-center justify-between">
            <span>Authority Rail</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
              ACTIVE
            </span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
          </p>
        </div>
      </div>
    </aside>
  );
}
