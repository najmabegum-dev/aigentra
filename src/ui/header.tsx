"use client";

import Link from "next/link";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  workspaceId?: string;
}

export function Header({ workspaceId }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyWorkspaceId = () => {
    if (!workspaceId) return;
    navigator.clipboard.writeText(workspaceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 border-b border-border bg-surface px-4 sm:px-6 flex items-center justify-between z-40">
      {/* Brand Wordmark with ShieldCheck Glyph */}
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-ink hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <span className="font-sans font-extrabold tracking-wider">AIGENTRA</span>
        </Link>

        <span className="hidden md:inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
          Bounded Financial Authority
        </span>
      </div>

      {/* Right controls: Workspace ID chip & Theme toggle */}
      <div className="flex items-center gap-3">
        {workspaceId ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-input bg-muted border border-border text-xs font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-ink">WS:</span>
            <span className="max-w-[120px] truncate" title={workspaceId}>
              {workspaceId}
            </span>
            <button
              type="button"
              onClick={copyWorkspaceId}
              aria-label="Copy workspace ID"
              className="p-0.5 hover:text-ink text-muted-foreground rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-status-allow" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">Demo Session</span>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
