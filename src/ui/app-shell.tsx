"use client";

import React, { useState } from "react";
import { PersistentBanners } from "./banners";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  children: React.ReactNode;
  workspaceId?: string;
  paymentMode?: "paypal" | "dev_stub";
}

export function AppShell({
  children,
  workspaceId,
  paymentMode = "dev_stub",
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans antialiased">
      {/* 32px Slim Status Bar */}
      <PersistentBanners paymentMode={paymentMode} />

      {/* Main Top Bar / Header */}
      <Header
        workspaceId={workspaceId}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Workspace Body: Collapsible Left Rail & Scrollable Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

      {/* Global Command Palette Dialog (Ctrl/Cmd+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}
