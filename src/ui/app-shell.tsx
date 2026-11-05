import React from "react";
import { PersistentBanners } from "./banners";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

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
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Persistent Top Banners */}
      <PersistentBanners paymentMode={paymentMode} />

      {/* Main Brand Header */}
      <Header workspaceId={workspaceId} />

      {/* Main Workspace Body with Sidebar & Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
