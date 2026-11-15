"use client";
import { useState } from "react";
import { KeyRound, Lock, Unlock, ShieldCheck, ShieldAlert, Loader2, Download, Inbox as InboxIcon, Bug } from "lucide-react";
import type { SealKeyPair } from "@qorechain/qoreseal";
import { EXPLORER, short } from "@/lib/config";
import { keysFromPhrase, openDrop, sha3hex, unhex, hex, fingerprint, type RecipientWithKeys } from "@/lib/crypto";

type Drop = { id: string; recipients: string[]; envelopeSha3: string; size: number; envelope: string; tx: string; block: number; timestamp: string | null };
type Opened = { state: "ok"; name: string; type: string; note?: string; bytes: Uint8Array; integrity: boolean } | { state: "fail"; reason: string; integrity: boolean };

export default function Inbox() {
  const [phrase, setPhrase] = useState("");
  const [me, setMe] = useState<(RecipientWithKeys & { role: string }) | null>(null);
  const [keys, setKeys] = useState<SealKeyPair | null>(null);
  const [drops, setDrops] = useState<Drop[] | null>(null);
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function unlock() {
    setErr(""); setBusy(true);
    try {
      const k = keysFromPhrase(phrase);
      const recips: (RecipientWithKeys & { role: string })[] = await (await fetch("/api/recipients")).json();
      const mine = recips.find((r) => r.keys.mlkemPublicKey && r.keys.mlkemPublicKey.replace(/^0x/, "") === hex(k.mlkemPublicKey).slice(2));
      if (!mine) throw new Error("These words don't match any registered recipient's on-chain ML-KEM key.");
      setKeys(k); setMe(mine); setPhrase(""); // forget the words immediately; keep only derived keys in memory
      await refresh(mine);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function refresh(who = me) {
    if (!who) return;
    const r = await fetch(`/api/drops?recipient=${who.id}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setDrops(j);
  }

  function openOne(d: Drop, tamper = false) {
    if (!keys) return;
    const env = unhex(d.envelope);
    if (tamper) env[env.length - 7] ^= 0x01; // flip one bit, as an attacker or a broken storage provider might
    const integrity = sha3hex(env) === d.envelopeSha3.toLowerCase();
    try {
      if (!integrity) throw new Error("Envelope hash does not match the hash anchored on QoreChain — refusing to open.");
      const f = openDrop(env, keys);
      setOpened((o) => ({ ...o, [d.id + (tamper ? ":t" : "")]: { state: "ok", ...f, integrity } }));
    } catch (e) {
      setOpened((o) => ({ ...o, [d.id + (tamper ? ":t" : "")]: { state: "fail", reason: e instanceof Error ? e.message : String(e), integrity } }));
    }
  }

  function save(o: Extract<Opened, { state: "ok" }>) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(o.bytes)], { type: o.type || "application/octet-stream" }));
    Object.assign(document.createElement("a"), { href: url, download: o.name }).click();
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-5 pb-16 pt-4">
        <div className="panel p-6">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(245,185,66,.12)", color: "var(--amber)" }}><KeyRound size={22} /></span>
          <h1 className="text-2xl font-extrabold">Journalist inbox</h1>
          <p className="mt-1 text-sm muted">Enter your recovery phrase to derive your decryption keys <b className="text-[var(--ink)]">on this device</b>. The words are never sent anywhere and are cleared as soon as your keys are derived.</p>
          <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} rows={4} spellCheck={false} autoComplete="off"
            placeholder="twenty four words …" className="mono mt-4 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-amber-400/60" />
          <button className="btn btn-amber mt-4 w-full justify-center" disabled={busy || phrase.trim().split(/\s+/).length < 12} onClick={unlock}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />} Unlock inbox
          </button>
          {err && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          <p className="mt-4 text-[11px] muted">Tip: on a phone, use “Add to Home Screen” to install Dead Drop as an app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><InboxIcon size={22} className="amber" /> {me.name}</h1>
          <p className="mono text-[11px] muted">{short(me.address, 10, 6)} · key {fingerprint(unhex(me.keys.mlkemPublicKey!))}</p>
        </div>
        <button className="btn btn-ghost text-sm" onClick={() => refresh().catch((e) => setErr(String(e)))}>Refresh</button>
      </div>
      {err && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-4">
        {drops === null && <p className="flex items-center gap-2 text-sm muted"><Loader2 size={14} className="animate-spin" /> Reading drops from QoreChain…</p>}
        {drops?.length === 0 && <p className="text-sm muted">No drops yet.</p>}
        {drops?.map((d) => {
          const o = opened[d.id], t = opened[d.id + ":t"];
          return (
            <article key={d.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="mono muted">#{d.id.slice(2, 10)} · {d.size.toLocaleString()} B · block {d.block}</span>
                <a className="mono amber hover:underline" href={`${EXPLORER}/tx/${d.tx}`} target="_blank" rel="noreferrer">{short(d.tx, 8, 6)}</a>
              </div>
              <p className="mt-1 text-xs muted">{d.timestamp ? new Date(d.timestamp).toLocaleString() : ""} · sealed to {d.recipients.length} recipient{d.recipients.length > 1 ? "s" : ""}</p>

              {!o && (
                <div className="mt-3">
                  <div className="cipher max-h-14 overflow-hidden opacity-70">{d.envelope.slice(2, 400)}…</div>
                  <button className="btn btn-amber mt-3 text-sm" onClick={() => openOne(d)}><Unlock size={15} /> Verify &amp; decrypt</button>
                </div>
              )}

              {o?.state === "ok" && (
                <div className="mt-3 rounded-xl border border-green-400/25 bg-green-400/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-green-400"><ShieldCheck size={14} /> sha3-256 matches the hash anchored on chain · decrypted on this device</p>
                  <p className="mt-2 font-semibold">{o.name}</p>
                  {o.note && <p className="mt-1 text-sm">“{o.note}”</p>}
                  {o.type.startsWith("text/") ? <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-sm">{new TextDecoder().decode(o.bytes)}</pre>
                    : o.type.startsWith("image/") ? <img alt={o.name} className="mt-2 max-h-80 rounded-lg" src={URL.createObjectURL(new Blob([new Uint8Array(o.bytes)], { type: o.type }))} />
                    : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn btn-ghost text-sm" onClick={() => save(o)}><Download size={15} /> Save file</button>
                    <button className="btn btn-ghost text-sm" onClick={() => openOne(d, true)}><Bug size={15} /> Simulate tampering</button>
                  </div>
                </div>
              )}
              {o?.state === "fail" && <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300"><Lock size={14} /> {o.reason}</p>}
              {t && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <span><b>One bit changed → refused.</b> {t.state === "fail" ? t.reason : "unexpectedly opened"}</span>
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
