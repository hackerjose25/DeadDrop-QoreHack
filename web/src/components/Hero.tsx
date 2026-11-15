"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./hero.css";

type Phase = "p1" | "splash" | "p2" | "idle";
const DUR: Record<Phase, number> = { p1: 800, splash: 800, p2: 800, idle: 1000 };

export function Navbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  const close = () => setOpen(false);
  return (
    <nav className="xr-nav">
      <Link href="/" className="nav-logo">Dead Drop</Link>
      <button className={`menu-toggle${open ? " active" : ""}`} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}><span /><span /></button>
      <div className={`nav-menu${open ? " active" : ""}`}>
        <ul className="nav-links">
          <li><a href="#how" onClick={close}>Method</a></li>
          <li><Link href="/verify" onClick={close}>Verify</Link></li>
          <li><Link href="/become" onClick={close}>Receive</Link></li>
        </ul>
        <div className="nav-actions">
          <Link href="/inbox" className="btn-login" onClick={close}>Inbox</Link>
          <Link href="/submit" className="btn-signup" onClick={close}>Submit</Link>
        </div>
      </div>
    </nav>
  );
}

export default function Hero() {
  const pipeline = useRef<HTMLDivElement>(null);
  const nodeStack = useRef<HTMLDivElement>(null);
  const nodeX = useRef<HTMLDivElement>(null);
  const nodeShield = useRef<HTMLDivElement>(null);
  const glowPath = useRef<SVGPathElement>(null);
  const corePath = useRef<SVGPathElement>(null);
  const gradient = useRef<SVGLinearGradientElement>(null);
  const splash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = pipeline.current, s = nodeStack.current, x = nodeX.current, sh = nodeShield.current;
    const g = glowPath.current, c = corePath.current, gr = gradient.current, sp = splash.current;
    if (!p || !s || !x || !sh || !g || !c || !gr || !sp) return;

    const layout = () => {
      const pR = p.getBoundingClientRect(), sR = s.getBoundingClientRect(), xR = x.getBoundingClientRect(), hR = sh.getBoundingClientRect();
      const pt = (r: DOMRect) => `${r.left + r.width / 2 - pR.left},${r.top + r.height / 2 - pR.top}`;
      const d = `M ${pt(sR)} L ${pt(xR)} L ${pt(hR)}`;
      g.setAttribute("d", d); c.setAttribute("d", d);
    };
    const setBeam = (pct: number) => {
      const center = pct * 100;
      gr.setAttribute("x1", `${center - 5}%`); gr.setAttribute("x2", `${center + 5}%`);
      gr.setAttribute("y1", "0%"); gr.setAttribute("y2", "0%");
    };
    const beamOpacity = (o: string) => { g.style.opacity = o === "1" ? "0.6" : o; c.style.opacity = o; };

    let phase: Phase = "p1", last = performance.now(), raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - last) / DUR[phase]);
      if (phase === "p1") {
        setBeam(t * 0.5);
        s.classList.toggle("active", t < 0.4);
        if (t >= 1) { phase = "splash"; last = now; beamOpacity("0"); sp.classList.add("animate"); }
      } else if (phase === "splash") {
        if (t >= 1) { phase = "p2"; last = now; sp.classList.remove("animate"); beamOpacity("1"); }
      } else if (phase === "p2") {
        setBeam(0.5 + t * 0.5);
        sh.classList.toggle("active", t > 0.6);
        if (t >= 1) { sh.classList.remove("active"); phase = "idle"; last = now; }
      } else if (t >= 1) { phase = "p1"; last = now; }
      raf = requestAnimationFrame(tick);
    };

    layout();
    window.addEventListener("resize", layout);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("resize", layout); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="hero-card">
      <div className="hero-grid" aria-hidden />
      <div className="icon-pipeline" ref={pipeline}>
        <svg className="beam-svg" aria-hidden>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="beam-gradient" ref={gradient} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#b04090" stopOpacity="0" />
              <stop offset="20%" stopColor="#b04090" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#fff" stopOpacity="1" />
              <stop offset="80%" stopColor="#c8a0e0" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#c8a0e0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path ref={glowPath} className="beam-glow" stroke="url(#beam-gradient)" strokeWidth="2" fill="none" filter="url(#glow)" />
          <path ref={corePath} className="beam-core" stroke="url(#beam-gradient)" strokeWidth="0.8" fill="none" />
        </svg>

        <div className="icon-node node-light-right" id="node-stack" ref={nodeStack} title="Your evidence">
          <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
        </div>
        <div className="pipeline-line" />
        <div className="pipeline-center">
          <div className="splash" ref={splash} />
          <div className="icon-node-center" id="node-x" ref={nodeX} title="Sealed with ML-KEM-1024">
            <svg viewBox="0 0 40 40" aria-hidden>
              <path fillRule="evenodd" d="M20 3 37 20 20 37 3 20Z M20 10 30 20 20 30 10 20Z" />
              <circle cx="20" cy="20" r="4" />
            </svg>
          </div>
        </div>
        <div className="pipeline-line right" />
        <div className="icon-node node-light-left" id="node-shield" ref={nodeShield} title="Only the recipient opens it">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
        </div>
      </div>

      <div className="hero-content">
        <h1 className="hero-heading">
          The safe way
          <strong>to expose the truth</strong>
        </h1>
        <p className="hero-sub">
          Evidence sealed in your browser with post-quantum encryption,<br />
          anchored on QoreChain, opened only by the journalist you choose.
        </p>
        <Link href="/submit" className="btn-cta">Submit Evidence</Link>
      </div>
    </section>
  );
}

export function Brands() {
  const I = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  return (
    <div className="brands">
      <div className="brand-item"><svg {...I}><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /></svg>QoreChain</div>
      <div className="brand-item"><svg {...I}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>ML-KEM-1024</div>
      <div className="brand-item"><svg {...I}><path d="M4 20c4-1 6-5 8-8s4-7 8-8" /><path d="M14 20h6" /></svg>ML-DSA-87</div>
      <div className="brand-item"><svg {...I}><path d="M9 3 7 21M17 3l-2 18M4 8h17M3 16h17" /></svg>SHA3-256</div>
      <div className="brand-item"><svg {...I}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>AES-256-GCM</div>
    </div>
  );
}
