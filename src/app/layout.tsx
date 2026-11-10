import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/ui/sonner";
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
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-background text-foreground">
        <main className="flex-1 flex flex-col">{children}</main>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
