import Link from "next/link";
import { Lock, EyeOff, Anchor, Smartphone, FileCheck2, ArrowRight } from "lucide-react";

const STEPS = [
  { Icon: Lock, t: "Sealed in your browser", d: "The file is encrypted on your device with QoreSeal (ML-KEM-1024 + X25519) to the journalist's key registered on QoreChain. Plaintext never leaves you." },
  { Icon: EyeOff, t: "Sent without your name", d: "A relayer with its own post-quantum key submits for you. Your wallet, your address — none of it touches the chain." },
  { Icon: Anchor, t: "Anchored for good", d: "The ciphertext and its SHA3-256 hash are written to QoreChain. Anyone can see that something was sent. Only the recipients can read it." },
  { Icon: Smartphone, t: "Opened on one phone", d: "The journalist derives their keys from a recovery phrase on their own device, checks the hash against the chain, and decrypts locally." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10">
      <section className="pt-10 sm:pt-16">
        <p className="mono text-xs amber">POST-QUANTUM WHISTLEBLOWING · QORECHAIN TESTNET</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
          Expose the truth.<br /><span className="amber">Not the source.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg muted">
          Dead Drop sends evidence to a journalist so that only they can ever open it — even when the encrypted archive is public,
          and even after quantum computers break today&apos;s encryption. <i>Harvest now, decrypt later</i> gets nothing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/submit" className="btn btn-amber">Submit evidence <ArrowRight size={16} /></Link>
          <Link href="/inbox" className="btn btn-ghost">Journalist inbox</Link>
          <Link href="/verify" className="btn btn-ghost"><FileCheck2 size={16} /> Verify a receipt</Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, t, d }, i) => (
          <div key={t} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(245,185,66,.12)", color: "var(--amber)" }}><Icon size={18} /></span>
              <span className="mono text-xs muted">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-bold">{t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed muted">{d}</p>
          </div>
        ))}
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-bold">Proof of Silence</h2>
        <p className="mt-1 max-w-3xl text-sm muted">
          Every submission returns a receipt: submission id, envelope hash, recipients&apos; key fingerprints, transaction and block.
          It proves this exact sealed file reached the chain — without revealing anything inside it. Check one on the <Link href="/verify" className="amber hover:underline">Verify</Link> page.
        </p>
      </section>

      <section className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
        {[["What we protect", "The content: only chosen recipients can decrypt, now and after Q-Day. Integrity: any change is detected."],
          ["What stays public", "That a submission happened, its size, its recipients and when it was included. Not who sent it."],
          ["What we don't claim", "That a document is true, or perfect anonymity on a hostile network. QoreSeal 0.1.0 is pending external review."]].map(([h, p]) => (
          <div key={h} className="panel p-5"><h3 className="font-bold">{h}</h3><p className="mt-1.5 muted">{p}</p></div>
        ))}
      </section>
    </div>
  );
}
