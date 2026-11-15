"use client";
import { useState } from "react";
import { FileCheck2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { short, txUrl } from "@/lib/config";

type Result = { matches: boolean; anchored: boolean; envelopeSha3: string; size: number; block: number; timestamp: string | null; inline: boolean };

export default function Verify() {
  const [raw, setRaw] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [rec, setRec] = useState<{ submissionId: string; envelopeSha3: string; tx?: string; cosmosTx?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function check() {
    setErr(""); setRes(null); setBusy(true);
    try {
      const r = JSON.parse(raw);
      if (!r.submissionId || !r.envelopeSha3) throw new Error("This doesn't look like a Proof of Silence receipt (needs submissionId and envelopeSha3).");
      setRec(r);
      const q = await fetch(`/api/verify?id=${r.submissionId}&sha3=${r.envelopeSha3}`);
      const j = await q.json();
      if (!q.ok) throw new Error(j.error);
      setRes(j);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function loadFile(f: File) { setRaw(await f.text()); }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight"><FileCheck2 className="amber" /> Verify a receipt</h1>
      <p className="mt-2 muted">A <b className="text-[var(--ink)]">Proof of Silence</b> shows that one exact sealed submission reached QoreChain at a given block — without revealing a single byte of what it contains. Anyone can check it.</p>
      <div className="panel mt-6 p-5">
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8} spellCheck={false} placeholder='Paste the receipt JSON, or load the file below'
          className="mono w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs outline-none focus:border-[#5ed29c]/60" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn btn-amber" disabled={busy || !raw.trim()} onClick={check}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Check against chain</button>
          <label className="btn btn-ghost cursor-pointer text-sm">Load receipt file<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} /></label>
        </div>
        {err && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      </div>
      {res && rec && (
        <div className={`panel mt-5 p-5 ${res.matches ? "border-green-400/30" : "border-red-400/30"}`}>
          {res.matches
            ? <p className="flex items-center gap-2 font-bold text-green-400"><CheckCircle2 size={18} /> Genuine: this exact envelope is anchored on QoreChain.</p>
            : <p className="flex items-center gap-2 font-bold text-red-400"><XCircle size={18} /> {res.anchored ? "Mismatch: the submission exists, but with a different envelope hash." : "Not found: no submission with this id on chain."}</p>}
          {res.anchored && (
            <dl className="mt-3 space-y-1.5 text-xs">
              {[["Submission", short(rec.submissionId, 10, 6)], ["Anchored sha3", short(res.envelopeSha3, 10, 6)], ["Size", `${res.size.toLocaleString()} B`], ["Block", String(res.block)], ["Included at", res.timestamp ?? ""], ["Ciphertext on chain", res.inline ? "yes (inline)" : "no (stored off chain)"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="muted">{k}</dt><dd className="mono">{v}</dd></div>
              ))}
              {rec.tx && <div className="flex justify-between gap-3"><dt className="muted">Transaction</dt><dd><a className="mono amber hover:underline" href={txUrl(rec.cosmosTx, res.block)} target="_blank" rel="noreferrer">{short(rec.tx, 10, 6)}</a></dd></div>}
            </dl>
          )}
          <p className="mt-3 text-[11px] muted">The time is when the submission was included in a block, not when the document was written. Encryption proves who can read it — not that its claims are true.</p>
        </div>
      )}
    </div>
  );
}
