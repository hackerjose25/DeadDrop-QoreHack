"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { ArrowRight, Menu, X } from "lucide-react";

// Background stream. NOTE: the template's Mux URL currently answers 403; on any error the video hides itself and the
// gradients / grid / glow carry the design. Swap in a working .m3u8 or .mp4 here.
const VIDEO = "https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8";
const GREEN = "#5ed29c", INK = "#070b0a";
const inter = { fontFamily: "'Inter', sans-serif" };
const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const serif = { fontFamily: "'Instrument Serif', serif" };
const LINKS: [string, string][] = [["SUBMIT", "/submit"], ["INBOX", "/inbox"], ["VERIFY", "/verify"], ["RECEIVE", "/become"]];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="Dead Drop home">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden>
        <rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" />
        <circle cx="12" cy="12" r="2.2" fill="white" stroke="none" />
      </svg>
      <span className="text-[15px] font-bold tracking-tight" style={inter}>Dead Drop</span>
    </Link>
  );
}

export { Logo };

export function Navbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <>
      <header className="absolute top-0 z-50 flex w-full items-center justify-between px-6 py-5 md:px-10">
        <Logo />
        <nav className="hidden items-center gap-10 md:flex">
          {LINKS.map(([t, h]) => <Link key={t} href={h} className="text-[16px] text-white/85 transition-colors hover:text-[#5ed29c]" style={inter}>{t}</Link>)}
        </nav>
        <button className="text-white md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={26} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col px-6 py-5 md:hidden" style={{ background: INK }}>
          <div className="flex items-center justify-between">
            <Logo />
            <button className="text-white" aria-label="Close menu" onClick={() => setOpen(false)}><X size={26} /></button>
          </div>
          <nav className="mt-16 flex flex-col gap-8">
            {LINKS.map(([t, h]) => <Link key={t} href={h} onClick={() => setOpen(false)} className="text-3xl font-bold text-white transition-colors hover:text-[#5ed29c]" style={inter}>{t}</Link>)}
          </nav>
        </div>
      )}
    </>
  );
}

/** Faint falling hex "ciphertext" — evokes sealed envelopes being written to the chain. Off for reduced-motion users. */
function CipherRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d")!;
    const CH = "0123456789abcdef", FS = 14;
    let cols: number[] = [], speed: number[] = [], w = 0, h = 0, raf = 0, last = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.ceil(w / (FS * 1.4));
      cols = Array.from({ length: n }, () => Math.random() * -h / FS);
      speed = Array.from({ length: n }, () => 0.25 + Math.random() * 0.6);
    };
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return; // ~20 fps is plenty for a backdrop
      last = t;
      ctx.fillStyle = "rgba(7,11,10,0.16)"; // fade previous frame → trails
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FS}px 'JetBrains Mono', monospace`;
      cols.forEach((y, i) => {
        const x = i * FS * 1.4, py = y * FS;
        ctx.fillStyle = Math.random() < 0.04 ? "rgba(190,255,225,0.85)" : "rgba(94,210,156,0.35)";
        ctx.fillText(CH[(Math.random() * 16) | 0], x, py);
        cols[i] = py > h + Math.random() * 400 ? 0 : y + speed[i];
      });
    };
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-50" aria-hidden />;
}

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(VIDEO);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => { /* autoplay prevented */ }); });
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { setVideoOk(false); hls.destroy(); } });
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = VIDEO;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); });
      video.addEventListener("error", () => setVideoOk(false));
    }
  }, []);

  return (
    <section className="relative flex min-h-screen w-full items-start overflow-hidden text-white" style={{ background: INK }}>
      <video ref={videoRef} muted loop playsInline className={`absolute inset-0 h-full w-full object-cover opacity-60 ${videoOk ? "" : "hidden"}`} />
      <CipherRain />
      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${INK} 0%, ${INK}cc 35%, transparent 100%)` }} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${INK} 0%, transparent 45%)` }} />

      {/* grid lines */}
      {["25%", "50%", "75%"].map((l, i) => (
        <div key={l} className="absolute inset-y-0 hidden w-px overflow-hidden bg-white/10 md:block" style={{ left: l }}>
          <span className="grid-pulse" style={{ animationDelay: `${i * 1.7}s`, animationDuration: `${5 + i}s` }} />
        </div>
      ))}

      {/* central glow */}
      <svg className="glow-breathe pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2" width="1100" height="420" viewBox="0 0 1100 420" aria-hidden>
        <defs>
          <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="25" /></filter>
          <radialGradient id="glowFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2fd5c4" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#0e5a45" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0e5a45" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="550" cy="210" rx="480" ry="120" fill="url(#glowFill)" filter="url(#glow)" />
      </svg>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-28 md:px-10 md:pt-[18vh]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ ...jakarta, color: GREEN }}>Post-Quantum Whistleblowing</p>
        <h1 className="mt-4 max-w-4xl text-[40px] font-extrabold uppercase leading-[1.02] tracking-tight sm:text-[56px] lg:text-[72px]" style={inter}>
          Expose the truth, not the source<span style={{ color: GREEN }}>.</span>
        </h1>
        <p className="mt-6 max-w-[512px] text-[14px] leading-relaxed text-white/70" style={inter}>
          Seal evidence in your own browser to a journalist&apos;s on-chain key. A relayer posts it for you, so no wallet and no name.
          Only the recipient can open it, today and after quantum computers break classical encryption.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link href="/submit" className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide transition hover:brightness-110" style={{ ...inter, background: GREEN, color: INK }}>
            Submit Evidence <ArrowRight size={16} />
          </Link>
          <Link href="/become" className="text-[13px] font-semibold uppercase tracking-wide text-white/70 transition-colors hover:text-[#5ed29c]" style={inter}>Become a recipient →</Link>
        </div>
      </div>
    </section>
  );
}
