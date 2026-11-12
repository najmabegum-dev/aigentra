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
    <header className="h-14 border-b border-line bg-surface px-3 sm:px-5 flex items-center justify-between z-30 select-none">
      {/* Left: Mobile hamburger menu & Brand Wordmark */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open mobile menu"
            className="md:hidden p-1.5 rounded-[4px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" strokeWidth={1.25} />
          </button>
        )}

        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-base tracking-tight text-text hover:opacity-90 transition-opacity"
        >
          <ShieldCheck className="w-5 h-5 text-signal" strokeWidth={1.25} />
          <span className="font-sans font-bold tracking-wider text-sm sm:text-base text-text">
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-[4px] bg-surface-2 hover:bg-surface border border-line text-xs font-mono text-text-dim hover:text-text transition-all duration-150 w-36 sm:w-56 md:w-64 justify-between cursor-pointer"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Search className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.25} />
              <span className="hidden sm:inline">Search modules...</span>
              <span className="sm:hidden">Search...</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-surface border border-line text-text-dim">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right controls: Status pill, Workspace chip & Theme toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status Pill (Real status: rounded-full) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-allow/10 text-allow border border-allow/30">
          <span className="w-1.5 h-1.5 rounded-full bg-allow" />
          <span>GUARD ACTIVE</span>
        </div>

        {/* Workspace Chip with Copy Button */}
        {workspaceId ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-surface-2 border border-line text-xs font-mono text-text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-allow inline-block" />
            <span className="font-bold text-text text-[11px]">WS:</span>
            <span className="max-w-[70px] sm:max-w-[110px] truncate text-[11px] text-text" title={workspaceId}>
              {workspaceId}
            </span>
            <button
              type="button"
              onClick={copyWorkspaceId}
              aria-label="Copy workspace ID"
              className="p-0.5 hover:text-text text-text-dim rounded transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-allow" strokeWidth={1.25} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={1.25} />
              )}
            </button>
          </div>
        ) : (
          <span className="hidden sm:inline text-xs text-text-dim font-mono">
            Demo Session
          </span>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
