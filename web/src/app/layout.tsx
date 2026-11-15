import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Dead Drop",
  description: "Post-quantum whistleblowing on QoreChain. Expose the truth without exposing the source.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#070b0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        <div className="grain" aria-hidden />
        <SiteHeader />
        <main className="relative z-10">{children}</main>
        <footer className="relative z-10 mx-auto max-w-6xl px-5 py-10 text-xs muted">
          Dead Drop · built on QoreChain testnet · QoreSeal 0.1.0 is pending external review · testnet demo, no real sources
        </footer>
      </body>
    </html>
  );
}
