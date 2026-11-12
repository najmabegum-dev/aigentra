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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/sheet";

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

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={150}>
      {/* =====================================================================
       * Desktop Collapsible Left Rail (md:flex)
       * ===================================================================== */}
      <aside
        aria-label="Workspace Navigation"
        className={cn(
          "hidden md:flex flex-col justify-between border-r border-line bg-surface shrink-0 transition-all duration-200 select-none",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Navigation Items */}
        <div className="p-2 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2 text-[10px] font-mono font-bold text-text-dim uppercase tracking-wider">
              Workspace Modules
            </div>
          )}

          <nav className="space-y-0.5">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              const Icon = item.icon;

              const content = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center rounded-[4px] font-mono text-xs transition-colors duration-150",
                    collapsed
                      ? "justify-center h-9 w-9 mx-auto"
                      : "gap-2.5 px-3 py-2 w-full",
                    isActive
                      ? "bg-surface-2 text-text border border-line font-semibold"
                      : "text-text-dim hover:text-text hover:bg-surface-2/60 border border-transparent"
                  )}
                >
                  {/* Active Indicator Bar on Expanded */}
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-signal" />
                  )}

                  {/* Icon */}
                  <Icon
                    strokeWidth={1.25}
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive
                        ? "text-signal"
                        : "text-text-dim group-hover:text-text"
                    )}
                  />

                  {/* Label (when expanded) */}
                  {!collapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.name}</span>
                    </div>
                  )}

                  {/* Active indicator dot in collapsed mode */}
                  {isActive && collapsed && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-signal" />
                  )}
                </Link>
              );

              // In collapsed mode, wrap in a Tooltip
              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right" className="font-mono text-xs">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-[11px] text-text-dim">
                        {item.description}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return content;
            })}
          </nav>
        </div>

        {/* Footer with Collapse Toggle & Authority Status */}
        <div className="p-2 border-t border-line bg-surface-2/40 space-y-2">
          {!collapsed && (
            <div className="rounded-[4px] border border-line p-2.5 bg-surface text-xs space-y-1">
              <div className="font-mono font-bold text-text flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-allow" strokeWidth={1.25} />
                  <span>Authority Rail</span>
                </span>
                <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-allow/10 text-allow font-mono font-bold border border-allow/30">
                  ACTIVE
                </span>
              </div>
              <p className="text-text-dim text-[10px] font-mono leading-relaxed">
                The AI proposes. AIGENTRA authorizes. PayPal executes.
              </p>
            </div>
          )}

          {/* Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex items-center rounded-[4px] p-2 text-xs font-mono text-text-dim hover:text-text hover:bg-surface-2 transition-colors duration-150 cursor-pointer border border-transparent hover:border-line",
                collapsed ? "justify-center w-full" : "w-full gap-2 px-3"
              )}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" strokeWidth={1.25} />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.25} />
                  <span>Collapse rail</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* =====================================================================
       * Mobile Bottom Navigation Bar (< md)
       * ===================================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-surface border-t border-line z-40 flex items-center justify-around px-2 select-none"
      >
        {NAVIGATION_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-[4px] transition-colors",
                isActive
                  ? "text-signal font-semibold"
                  : "text-text-dim hover:text-text"
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={1.25} />
              <span className="text-[10px] font-mono tracking-tight mt-1">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* =====================================================================
       * Mobile Drawer Sheet (< md)
       * ===================================================================== */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="w-72 p-0 bg-surface">
          <SheetHeader className="p-4 border-b border-line">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-text">
              <ShieldCheck className="w-5 h-5 text-signal" strokeWidth={1.25} />
              <span>AIGENTRA</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-text-dim font-mono">
              Bounded financial authorization layer
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono font-bold text-text-dim uppercase tracking-wider">
              Modules
            </div>
            {NAVIGATION_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onMobileClose?.()}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-xs font-mono transition-colors",
                    isActive
                      ? "bg-surface-2 text-text border border-line font-bold"
                      : "text-text-dim hover:text-text hover:bg-surface-2/60"
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.25} />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    <span className="text-[10px] text-text-dim">
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
