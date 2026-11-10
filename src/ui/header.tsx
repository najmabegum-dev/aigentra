"use client";

import Link from "next/link";
import { ShieldCheck, Copy, Check, Search, Menu } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  workspaceId?: string;
  onOpenMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
}

export function Header({
  workspaceId,
  onOpenMobileMenu,
  onOpenCommandPalette,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyWorkspaceId = () => {
    if (!workspaceId) return;
    navigator.clipboard.writeText(workspaceId);
    setCopied(true);
    toast.success("Workspace ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-14 border-b border-border bg-surface/90 px-3 sm:px-5 flex items-center justify-between z-30 backdrop-blur-sm select-none">
      {/* Left: Mobile hamburger menu & Brand Wordmark */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open mobile menu"
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-base tracking-tight text-foreground hover:opacity-90 transition-opacity"
        >
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-soft-sm">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <span className="font-sans font-extrabold tracking-wider text-sm sm:text-base">
            AIGENTRA
          </span>
        </Link>
      </div>

      {/* Center: Command Palette Trigger Button (Ctrl/Cmd+K) */}
      <div className="flex items-center">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-raised/80 hover:bg-surface-raised border border-border text-xs text-muted-foreground hover:text-foreground transition-all duration-150 w-36 sm:w-56 md:w-64 justify-between shadow-soft-sm"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Search modules...</span>
              <span className="sm:hidden">Search...</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right controls: Status pill, Workspace chip & Theme toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-soft-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>GUARD ACTIVE</span>
        </div>

        {/* Workspace Chip with Copy Button */}
        {workspaceId ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/80 border border-border text-xs font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-foreground text-[11px]">WS:</span>
            <span className="max-w-[70px] sm:max-w-[110px] truncate text-[11px]" title={workspaceId}>
              {workspaceId}
            </span>
            <button
              type="button"
              onClick={copyWorkspaceId}
              aria-label="Copy workspace ID"
              className="p-0.5 hover:text-foreground text-muted-foreground rounded transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ) : (
          <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
            Demo Session
          </span>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
