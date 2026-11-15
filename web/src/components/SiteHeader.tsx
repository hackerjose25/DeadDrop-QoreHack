"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Standard header for inner pages; the home page uses the hero's own transparent navbar. */
export default function SiteHeader() {
  if (usePathname() === "/") return null;
  return (
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
  );
}
