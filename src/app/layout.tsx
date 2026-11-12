import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/ui/sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={`dark ${instrumentSerif.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen flex flex-col font-sans antialiased bg-background text-foreground">
        <main className="flex-1 flex flex-col">{children}</main>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
