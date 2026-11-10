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
          "hidden md:flex flex-col justify-between border-r border-border bg-surface shrink-0 transition-all duration-200 select-none",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Navigation Items */}
        <div className="p-2 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
              Workspace Modules
            </div>
          )}

          <nav className="space-y-1">
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
                    "group relative flex items-center rounded-md font-medium text-sm transition-all duration-150",
                    collapsed
                      ? "justify-center h-10 w-10 mx-auto"
                      : "gap-3 px-3 py-2 w-full",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-soft-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  {/* Active Indicator Bar on Expanded */}
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary shadow-glow-blue" />
                  )}

                  {/* Icon */}
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
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
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary ring-2 ring-surface" />
                  )}
                </Link>
              );

              // In collapsed mode, wrap in a Tooltip
              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right" className="font-sans text-xs">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-[11px] text-primary-foreground/80">
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
        <div className="p-2 border-t border-border bg-surface-raised/30 space-y-2">
          {!collapsed && (
            <div className="rounded-md border border-border p-2.5 bg-surface text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Authority Rail</span>
                </span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800/60">
                  ACTIVE
                </span>
              </div>
              <p className="text-muted-foreground text-[10px] leading-relaxed">
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
                "flex items-center rounded-md p-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors duration-150",
                collapsed ? "justify-center w-full" : "w-full gap-2 px-3"
              )}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
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
        className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-surface/95 border-t border-border z-40 flex items-center justify-around px-2 backdrop-blur-md select-none"
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
                "flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-md transition-colors",
                  isActive && "bg-primary/10 border border-primary/20"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">
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
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>AIGENTRA</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Bounded financial authorization layer
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    <span
                      className={cn(
                        "text-[11px]",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
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
