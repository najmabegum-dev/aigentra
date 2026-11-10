"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Bot,
  CheckCircle2,
  LayoutDashboard,
  Zap,
  Settings,
  Copy,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  workspaceId,
}: CommandPaletteProps) {
  const router = useRouter();

  // Listen for Ctrl+K or Cmd+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleNavigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleCopyWorkspace = () => {
    if (!workspaceId) return;
    navigator.clipboard.writeText(workspaceId);
    toast.success("Workspace ID copied to clipboard");
    onOpenChange(false);
  };

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
      toast.info("Switched to Light mode");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
      toast.info("Switched to Dark mode");
    }
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search workspace modules..." />
      <CommandList>
        <CommandEmpty>No matching module or action found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => handleNavigate("/policies")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Policies Studio</span>
              <span className="text-xs text-muted-foreground">
                Guardrails, caps, velocity windows & kill switch
              </span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => handleNavigate("/agent")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Bot className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Agent Workspace</span>
              <span className="text-xs text-muted-foreground">
                Autonomous shopper, proposal builder & live cart
              </span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => handleNavigate("/approvals")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-status-approval" />
            <div className="flex flex-col">
              <span className="font-medium">Approval Centre</span>
              <span className="text-xs text-muted-foreground">
                Pending mandates, cryptographic approvals & queue
              </span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => handleNavigate("/studio")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-purple-400" />
            <div className="flex flex-col">
              <span className="font-medium">Control Tower</span>
              <span className="text-xs text-muted-foreground">
                AG Studio telemetry, spend budget ring & Auditor agent
              </span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => handleNavigate("/attack-lab")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-status-deny" />
            <div className="flex flex-col">
              <span className="font-medium">Attack Lab</span>
              <span className="text-xs text-muted-foreground">
                7 adversarial security scenarios & 0 PayPal calls proof
              </span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => handleNavigate("/settings")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <div className="flex flex-col">
              <span className="font-medium">Settings & Diagnostics</span>
              <span className="text-xs text-muted-foreground">
                Environment health, payment mode & database status
              </span>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {workspaceId && (
            <CommandItem
              onSelect={handleCopyWorkspace}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-emerald-400" />
              <span>Copy Current Workspace ID</span>
            </CommandItem>
          )}

          <CommandItem
            onSelect={handleToggleTheme}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Sun className="w-4 h-4 text-amber-400 dark:hidden" />
            <Moon className="w-4 h-4 text-slate-400 hidden dark:inline" />
            <span>Toggle Color Theme (Dark / Light)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
