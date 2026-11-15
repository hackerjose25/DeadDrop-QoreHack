"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";

const VIDEO = "https://stream.mux.com/T6oQJQ02cQ6N01TR6iHwZkKFkbepS34dkkIc9iukgy400g.m3u8";
const POSTER = "https://images.unsplash.com/photo-1647356191320-d7a1f80ca777?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwbmV1cmFsJTIwbmV0d29ya3xlbnwxfHx8fDE3Njg5NzIyNTV8MA&ixlib=rb-4.1.0&q=80&w=1080";
const sans = { fontFamily: "'Instrument Sans', sans-serif" };
const serif = { fontFamily: "'Instrument Serif', serif" };

function Sunburst() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6, r = (n: number) => Math.round(n * 100) / 100; // rounded: identical on server and client
        return <line key={i} x1={r(12 + 4 * Math.cos(a))} y1={r(12 + 4 * Math.sin(a))} x2={r(12 + 10 * Math.cos(a))} y2={r(12 + 10 * Math.sin(a))} />;
      })}
      <circle cx="12" cy="12" r="2" fill="white" stroke="none" />
    </svg>
  );
}

export function Navbar() {
  const links: [string, string, boolean?][] = [["How it works", "#how", true], ["Submit", "/submit"], ["Inbox", "/inbox"], ["Verify", "/verify"]];
  return (
    <nav className="fixed top-0 z-50 flex w-full items-center justify-between bg-transparent px-6 py-4" style={sans}>
      <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="Dead Drop home"><Sunburst /><span className="text-sm font-semibold">Dead Drop</span></Link>
      <div className="hidden items-center gap-8 md:flex">
        {links.map(([t, h, chev]) => (
          <Link key={t} href={h} className="flex items-center gap-1 text-sm font-medium text-white/80 transition hover:text-white">{t}{chev && <ChevronDown size={14} />}</Link>
        ))}
      </div>
      <div className="flex items-center gap-5">
        <Link href="/become" className="hidden text-sm font-medium text-white/80 transition hover:text-white sm:block">Become a Recipient</Link>
        <Link href="/submit" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Get Started</Link>
      </div>
    </nav>
  );
}

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(VIDEO);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => { /* autoplay prevented */ }); });
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = VIDEO;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => { /* autoplay prevented */ }); });
    }
  }, []);

  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-black px-6 text-white">
      <video ref={videoRef} muted loop playsInline poster={POSTER} className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute left-[20%] top-[-20%] h-[600px] w-[600px] rounded-full bg-blue-900/20 mix-blend-screen blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[20%] h-[500px] w-[500px] rounded-full bg-indigo-900/20 mix-blend-screen blur-[120px]" />

      <div className="relative z-10 mx-auto mt-20 flex max-w-5xl flex-col items-center space-y-12 text-center">
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-3xl leading-[1.1] text-white sm:text-5xl lg:text-[48px]" style={serif}>
          Expose the truth, not the source
        </motion.p>
        <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-gradient-to-b from-white via-white to-[#b4c0ff] bg-clip-text pb-2 text-6xl font-semibold leading-[0.9] tracking-tighter text-transparent sm:text-8xl lg:text-[136px]" style={sans}>
          Dead Drop
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-xl text-lg leading-[1.65] text-white sm:text-[20px]" style={sans}>
          Seal evidence in your browser with post-quantum ML-KEM-1024. Only the journalist you choose can ever open it, even after Q-Day.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col items-center gap-6 sm:flex-row">
          <Link href="/submit" className="group flex items-center gap-4 rounded-full bg-white py-2 pl-6 pr-2 transition hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <span className="text-lg font-medium text-[#0a0400]" style={sans}>Submit Evidence</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3054ff] transition group-hover:bg-[#2040e0]"><ArrowRight size={20} className="text-white" /></span>
          </Link>
          <Link href="/inbox" className="group flex items-center gap-2 rounded-lg px-4 py-2 text-white/70 backdrop-blur-sm transition hover:bg-white/5 hover:text-white" style={sans}>
            Open Inbox <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
