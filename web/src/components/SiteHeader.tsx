"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "./Hero";

const LINKS: [string, string][] = [["SUBMIT", "/submit"], ["INBOX", "/inbox"], ["VERIFY", "/verify"], ["RECEIVE", "/become"]];

/** Header for inner pages, styled like the landing hero's navbar. The home page renders the hero's own navbar. */
export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (path === "/") return null;
  return (
    <>
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
        <Logo />
        <nav className="hidden items-center gap-10 md:flex">
          {LINKS.map(([t, h]) => (
            <Link key={t} href={h} className={`text-[15px] transition-colors hover:text-[#5ed29c] ${path.startsWith(h) ? "text-[#5ed29c]" : "text-white/85"}`}>{t}</Link>
          ))}
        </nav>
        <button className="text-white md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={26} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#070b0a] px-6 py-5 md:hidden">
          <div className="flex items-center justify-between"><Logo /><button className="text-white" aria-label="Close menu" onClick={() => setOpen(false)}><X size={26} /></button></div>
          <nav className="mt-16 flex flex-col gap-8">
            {LINKS.map(([t, h]) => <Link key={t} href={h} onClick={() => setOpen(false)} className="text-3xl font-bold text-white hover:text-[#5ed29c]">{t}</Link>)}
          </nav>
        </div>
      )}
    </>
  );
}
