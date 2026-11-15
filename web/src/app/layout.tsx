import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dead Drop",
  description: "Post-quantum whistleblowing on QoreChain. Expose the truth without exposing the source.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#08090b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        <div className="grain" aria-hidden />
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="inline-block h-3 w-3 rotate-45 rounded-sm" style={{ background: "var(--amber)" }} />
            Dead Drop
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/submit" className="rounded-full px-3 py-2 hover:bg-white/5">Submit</Link>
            <Link href="/inbox" className="rounded-full px-3 py-2 hover:bg-white/5">Inbox</Link>
            <Link href="/verify" className="rounded-full px-3 py-2 hover:bg-white/5">Verify</Link>
            <Link href="/become" className="rounded-full px-3 py-2 hover:bg-white/5">Receive</Link>
          </nav>
        </header>
        <main className="relative z-10">{children}</main>
        <footer className="relative z-10 mx-auto max-w-6xl px-5 py-10 text-xs muted">
          Dead Drop · built on QoreChain testnet · QoreSeal 0.1.0 is pending external review · testnet demo, no real sources
        </footer>
      </body>
    </html>
  );
}
