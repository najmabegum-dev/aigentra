import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIGENTRA — Bounded Financial Authority for AI",
  description: "The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <aside
          role="status"
          aria-label="Sandbox Environment Banner"
          className="bg-status-sandbox text-white text-xs font-semibold py-1.5 px-4 text-center tracking-wide uppercase select-none"
        >
          SANDBOX ENVIRONMENT — Settlement Stand-In Only — No Real Funds Moved
        </aside>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
