"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Upload, Lock, Send, Download, CheckCircle2, XCircle, Loader2, FileText, EyeOff, UserPlus, ShieldQuestion } from "lucide-react";
import { SCHEME, CHAIN_ID, short, txUrl } from "@/lib/config";
import { sealDrop, packFile, verifiedRecipient, b64, fingerprint, unhex, type RecipientWithKeys } from "@/lib/crypto";

type Stage = "idle" | "sealing" | "sealed" | "sending" | "done" | "error";
type Receipt = Record<string, unknown> & { tx: string; cosmosTx?: string | null; block?: number; submissionId: string; envelopeSha3: string };

export default function Submit() {
  const [recips, setRecips] = useState<(RecipientWithKeys & { role: string; ok?: boolean; err?: string })[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({ journalist: true, editor: true });
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [sealed, setSealed] = useState<{ envelope: Uint8Array; id: string; sha3: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [addr, setAddr] = useState("");
  const [addErr, setAddErr] = useState("");
  const [adding, setAdding] = useState(false);

  const check = (r: RecipientWithKeys & { role: string }) => {
    try { verifiedRecipient(r); return { ...r, ok: true }; } catch (e) { return { ...r, ok: false, err: String(e) }; }
  };

  /** Look up any QoreChain address that registered an inbox key, and select it. */
  async function addRecipient(a: string, only = false) {
    setAddErr(""); setAdding(true);
    try {
      const r = await fetch(`/api/recipients/lookup?address=${encodeURIComponent(a.trim())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRecips((all) => (all.some((x) => x.id === j.id) ? all : [...all, check(j)]));
      setChosen((c) => (only ? { [j.id]: true } : { ...c, [j.id]: true }));
      setAddr("");
    } catch (e) { setAddErr(e instanceof Error ? e.message : String(e)); }
    finally { setAdding(false); }
  }

  useEffect(() => {
    fetch("/api/recipients").then((r) => r.json()).then((list) => {
      if (!Array.isArray(list)) throw new Error(list.error);
      setRecips(list.map(check));
      const to = new URLSearchParams(location.search).get("to");
      if (to) addRecipient(to, true); // shared link from /become: preselect just that recipient
    }).catch((e) => setErr(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = recips.filter((r) => chosen[r.id] && r.ok);
  const canSeal = targets.length > 0 && (file || text.trim()) && stage !== "sealing" && stage !== "sending";

  async function doSeal() {
    setErr(""); setStage("sealing"); setReceipt(null);
    try {
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(text);
      const payload = packFile(file?.name || "statement.txt", file?.type || "text/plain", bytes, file && text.trim() ? text.trim() : undefined);
      await new Promise((r) => setTimeout(r, 350)); // let the "sealing" state paint
      const s = sealDrop(payload, targets);
      if (s.envelope.length > 48 * 1024) throw new Error(`Envelope is ${(s.envelope.length / 1024).toFixed(1)} KB; the demo accepts up to 48 KB inline. Try a smaller file.`);
      setSealed(s); setStage("sealed");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStage("error"); }
  }

  async function doSend() {
    if (!sealed) return;
    setStage("sending"); setErr("");
    try {
      const r = await fetch("/api/relay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: sealed.id, recipients: targets.map((t) => t.id), envelope: b64(sealed.envelope) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setReceipt({ type: "Dead Drop · Proof of Silence", ...j, scheme: SCHEME, chainId: CHAIN_ID, recipientKeyFingerprints: targets.map((t) => fingerprint(unhex(t.keys.mlkemPublicKey!))) });
      setStage("done");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStage("error"); }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `proof-of-silence-${receipt.submissionId.slice(2, 10)}.json` }).click();
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Submit evidence</h1>
      <p className="mt-2 max-w-2xl muted">Your file is encrypted <b className="text-[var(--ink)]">in this browser</b> before anything is sent. Only the people you pick can open it — even after Q-Day. No account, no wallet, and your address never touches the chain.</p>

      <div className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* 1. recipients */}
          <section className="panel p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">1 · Who can open it</h2>
            {recips.length === 0 && !err && <p className="flex items-center gap-2 text-sm muted"><Loader2 size={14} className="animate-spin" /> Loading recipients and verifying their keys…</p>}
            <div className="space-y-2">
              {recips.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3 hover:bg-white/[.04]">
                  <input type="checkbox" className="h-4 w-4 accent-[#5ed29c]" checked={!!chosen[r.id]} disabled={!r.ok} onChange={(e) => setChosen({ ...chosen, [r.id]: e.target.checked })} />
                  <div className="flex-1">
                    <p className="font-semibold">{r.name} <span className="text-xs font-normal muted">· {r.role}</span></p>
                    <p className="mono text-[11px] muted">{short(r.address, 10, 6)} · ML-KEM key {r.keys.mlkemPublicKey ? fingerprint(unhex(r.keys.mlkemPublicKey)) : "—"}</p>
                  </div>
                  {!r.ok ? <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={14} /> forged / missing key</span>
                    : r.card ? <span className="flex items-center gap-1 text-xs text-green-400"><ShieldCheck size={14} /> card verified</span>
                    : <span className="flex items-center gap-1 text-right text-xs amber" title="The ML-KEM key is on chain, registered by this wallet's own hybrid-signed tx. Who owns the wallet is not vouched for: compare the key fingerprint with them out-of-band."><ShieldQuestion size={14} /> key on chain · identity unverified</span>}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addr.trim() && addRecipient(addr)} placeholder="Any recipient's address — qor1… or 0x…" spellCheck={false}
                className="mono min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-[#5ed29c]/60" />
              <button className="btn btn-ghost text-sm" disabled={adding || !addr.trim()} onClick={() => addRecipient(addr)}>{adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add</button>
            </div>
            {addErr && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{addErr}</p>}
            <p className="mt-3 text-xs muted">Each card is signed with the recipient&apos;s ECDSA + ML-DSA-87 keys and checked here against the keys registered on QoreChain. Any wallet can <a href="/become" className="amber hover:underline">become a recipient</a>; for those, the inbox key itself is on chain but the person behind it isn&apos;t vouched for.</p>
          </section>

          {/* 2. file */}
          <section className="panel p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">2 · What to send</h2>
            <button onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-8 text-sm hover:bg-white/[.03]">
              {file ? <><FileText size={22} className="amber" /><span className="font-semibold">{file.name}</span><span className="muted">{(file.size / 1024).toFixed(1)} KB · will be sealed with its name</span></>
                : <><Upload size={22} className="amber" /><span className="font-semibold">Choose a file</span><span className="muted">PDF, image, text — up to ~40 KB in this demo</span></>}
            </button>
            <input ref={inputRef} type="file" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStage("idle"); setSealed(null); }} />
            <textarea value={text} onChange={(e) => { setText(e.target.value); setStage("idle"); setSealed(null); }} rows={3}
              placeholder={file ? "Optional note for the journalist (sealed too)" : "…or just type what you know"}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-[#5ed29c]/60" />
          </section>

          <div className="flex flex-wrap gap-3">
            <button className="btn btn-amber" disabled={!canSeal} onClick={doSeal}>
              {stage === "sealing" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Seal in browser
            </button>
            <button className="btn btn-ghost" disabled={stage !== "sealed"} onClick={doSend}>
              {stage === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send through relayer
            </button>
          </div>
          {err && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
        </div>

        {/* right: what the world sees */}
        <div className="space-y-5 lg:col-span-2">
          <section className={`panel p-5 ${stage === "sealing" ? "scanning" : ""}`}>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest muted"><EyeOff size={14} /> What the public chain will see</h2>
            {sealed ? (
              <>
                <p className="mb-2 text-xs muted">{sealed.envelope.length.toLocaleString()} bytes · sha3-256 <span className="mono amber">{short(sealed.sha3, 10, 6)}</span></p>
                <div className="cipher max-h-64 overflow-hidden">{Array.from(sealed.envelope.subarray(0, 900), (b) => b.toString(16).padStart(2, "0")).join("")}…</div>
              </>
            ) : <p className="text-sm muted">Nothing yet. Seal something and the ciphertext appears here — this is all anyone, including us, will ever see.</p>}
          </section>

          {receipt && (
            <section className="panel border-green-400/30 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-green-400"><CheckCircle2 size={16} /> Anchored on QoreChain</h2>
              <dl className="space-y-1.5 text-xs">
                {[["Submission", short(receipt.submissionId, 10, 6)], ["Envelope sha3", short(receipt.envelopeSha3, 10, 6)], ["Block", String(receipt.block)], ["Time", String(receipt.timestamp)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="muted">{k}</dt><dd className="mono">{v}</dd></div>
                ))}
                <div className="flex justify-between gap-3"><dt className="muted">Transaction</dt><dd><a className="mono amber hover:underline" href={txUrl(receipt.cosmosTx, receipt.block)} target="_blank" rel="noreferrer">{short(receipt.tx, 10, 6)}</a></dd></div>
              </dl>
              <button className="btn btn-amber mt-4 w-full justify-center" onClick={downloadReceipt}><Download size={16} /> Download Proof of Silence</button>
              <p className="mt-2 text-[11px] muted">Keep it private. It proves this exact sealed file reached the chain at this block — without revealing anything inside it.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
