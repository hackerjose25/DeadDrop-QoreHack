"use client";
import { useEffect, useState } from "react";
import { KeyRound, Lock, Unlock, ShieldCheck, ShieldAlert, Loader2, Download, Inbox as InboxIcon, Bug, Fingerprint, LogOut } from "lucide-react";
import type { SealKeyPair } from "@qorechain/qoreseal";
import { short, txUrl } from "@/lib/config";
import { loadVault, forgetVault, setupPasskey, setupPassword, unlockVault, passkeyAvailable, type Vault } from "@/lib/vault";
import { keysFromPhrase, openDrop, sha3hex, unhex, hex, fingerprint, type RecipientWithKeys } from "@/lib/crypto";

type Drop = { id: string; recipients: string[]; envelopeSha3: string; size: number; envelope: string; tx: string; cosmosTx?: string | null; block: number; timestamp: string | null };
type Opened = { state: "ok"; name: string; type: string; note?: string; bytes: Uint8Array; integrity: boolean } | { state: "fail"; reason: string; integrity: boolean };

export default function Inbox() {
  const [phrase, setPhrase] = useState("");
  const [me, setMe] = useState<(RecipientWithKeys & { role: string }) | null>(null);
  const [keys, setKeys] = useState<SealKeyPair | null>(null);
  const [drops, setDrops] = useState<Drop[] | null>(null);
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [vault, setVault] = useState<Vault | null>(null);
  const [usePhrase, setUsePhrase] = useState(false);
  const [pw, setPw] = useState("");
  const [canPasskey, setCanPasskey] = useState(false);
  const [offer, setOffer] = useState(false); // after a phrase unlock: offer to remember this device
  const [saved, setSaved] = useState("");

  useEffect(() => { setVault(loadVault()); passkeyAvailable().then(setCanPasskey); }, []);

  /** Find who these keys belong to: a curated recipient, or (given the address) any wallet that became a recipient. */
  async function enter(k: SealKeyPair, address?: string) {
    const matches = (r: RecipientWithKeys) => !!r.keys.mlkemPublicKey && r.keys.mlkemPublicKey.replace(/^0x/, "") === hex(k.mlkemPublicKey).slice(2);
    const recips: (RecipientWithKeys & { role: string })[] = await (await fetch("/api/recipients")).json();
    let mine = recips.find(matches);
    if (!mine && address) {
      const r = await fetch(`/api/recipients/lookup?address=${encodeURIComponent(address)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (matches(j)) mine = j;
    }
    if (!mine) throw new Error("These keys don't match an inbox key registered on QoreChain. New here? Register on the Become a recipient page first.");
    setKeys(k); setMe(mine);
    await refresh(mine);
  }

  async function run(f: () => Promise<unknown>) {
    setErr(""); setBusy(true);
    try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const unlock = () => run(async () => {
    const words = phrase;
    setPhrase(""); // forget the words immediately; keep only derived keys in memory
    const k = keysFromPhrase(words);
    const { deriveUnifiedAccount } = await import("@qorechain/sdk");
    await enter(k, (await deriveUnifiedAccount(words.trim().toLowerCase().replace(/\s+/g, " "))).cosmos);
    setOffer(true);
  });

  const unlockSaved = () => run(async () => { await enter(await unlockVault(vault!, pw), vault!.recipientId); setPw(""); });

  const remember = (kind: "passkey" | "password") => run(async () => {
    if (!keys || !me) return;
    if (kind === "passkey") await setupPasskey(keys, me); else { await setupPassword(keys, me, pw); setPw(""); }
    setVault(loadVault()); setOffer(false);
    setSaved(kind === "passkey" ? "Saved. Next time, unlock with your fingerprint / face / device PIN." : "Saved. Next time, unlock with your password.");
  });

  function lock() { setKeys(null); setMe(null); setDrops(null); setOpened({}); setPw(""); setUsePhrase(false); setOffer(false); setSaved(""); }
  function forget() { forgetVault(); setVault(null); lock(); }

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
    const errBox = err && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>;
    const badge = (icon: React.ReactNode) => <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(245,185,66,.12)", color: "var(--amber)" }}>{icon}</span>;

    if (vault && !usePhrase) {
      return (
        <div className="mx-auto max-w-md px-5 pb-16 pt-4">
          <div className="panel p-6">
            {badge(<Fingerprint size={22} />)}
            <h1 className="text-2xl font-extrabold">Welcome back, {vault.name.split(" ")[0]}</h1>
            <p className="mt-1 text-sm muted">Your decryption keys are stored on this device, encrypted. Unlock them with your {vault.kind === "passkey" ? "passkey (fingerprint, face or device PIN)" : "password"}. No recovery phrase needed.</p>
            {vault.kind === "password" && (
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pw && unlockSaved()} autoComplete="current-password" placeholder="Password"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-amber-400/60" />
            )}
            <button className="btn btn-amber mt-4 w-full justify-center" disabled={busy || (vault.kind === "password" && !pw)} onClick={unlockSaved}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : vault.kind === "passkey" ? <Fingerprint size={16} /> : <Unlock size={16} />} Unlock inbox
            </button>
            {errBox}
            <div className="mt-4 flex justify-between text-[11px] muted">
              <button className="hover:underline" onClick={() => { setErr(""); setUsePhrase(true); }}>Use recovery phrase instead</button>
              <button className="hover:underline" onClick={() => { if (confirm("Remove the saved keys from this device? You'll need your recovery phrase to set it up again.")) forget(); }}>Forget this device</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-md px-5 pb-16 pt-4">
        <div className="panel p-6">
          {badge(<KeyRound size={22} />)}
          <h1 className="text-2xl font-extrabold">Journalist inbox</h1>
          <p className="mt-1 text-sm muted">First time on this device: enter your recovery phrase <b className="text-[var(--ink)]">once</b> to derive your decryption keys here. The words are never sent anywhere and are cleared straight away. Then lock the keys behind a passkey so you won&apos;t need the phrase again.</p>
          <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} rows={4} spellCheck={false} autoComplete="off"
            placeholder="twenty four words …" className="mono mt-4 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-amber-400/60" />
          <button className="btn btn-amber mt-4 w-full justify-center" disabled={busy || phrase.trim().split(/\s+/).length < 12} onClick={unlock}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />} Unlock inbox
          </button>
          {errBox}
          {vault && <button className="mt-4 text-[11px] muted hover:underline" onClick={() => { setErr(""); setUsePhrase(false); }}>← Back to {vault.kind} unlock</button>}
          <p className="mt-4 text-[11px] muted">Not a recipient yet? <a href="/become" className="amber hover:underline">Register your wallet&apos;s inbox key</a>.</p>
          <p className="mt-2 text-[11px] muted">Tip: on a phone, use “Add to Home Screen” to install Dead Drop as an app.</p>
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
        <div className="flex gap-2">
          <button className="btn btn-ghost text-sm" onClick={() => refresh().catch((e) => setErr(String(e)))}>Refresh</button>
          <button className="btn btn-ghost text-sm" onClick={lock}><LogOut size={15} /> Lock</button>
        </div>
      </div>
      {err && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      {offer && (
        <div className="panel mt-4 p-4" style={{ borderColor: "rgba(245,185,66,.35)" }}>
          <p className="flex items-center gap-2 font-semibold"><Fingerprint size={18} className="amber" /> Skip the recovery phrase next time</p>
          <p className="mt-1 text-sm muted">Keep only your <b className="text-[var(--ink)]">decryption keys</b> on this device, encrypted. They can open drops but can&apos;t sign, move funds or change your on-chain keys. The phrase itself is never stored.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canPasskey && <button className="btn btn-amber text-sm" disabled={busy} onClick={() => remember("passkey")}><Fingerprint size={15} /> Use a passkey</button>}
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder={canPasskey ? "or a password (10+ chars)" : "Password (10+ chars)"}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-amber-400/60" />
            <button className="btn btn-ghost text-sm" disabled={busy || pw.length < 10} onClick={() => remember("password")}>Save with password</button>
            <button className="text-xs muted hover:underline" onClick={() => setOffer(false)}>Not now</button>
          </div>
        </div>
      )}
      {saved && <p className="mt-3 rounded-xl bg-green-400/10 p-3 text-sm text-green-300">{saved}</p>}

      <div className="mt-6 space-y-4">
        {drops === null && <p className="flex items-center gap-2 text-sm muted"><Loader2 size={14} className="animate-spin" /> Reading drops from QoreChain…</p>}
        {drops?.length === 0 && <p className="text-sm muted">No drops yet.</p>}
        {drops?.map((d) => {
          const o = opened[d.id], t = opened[d.id + ":t"];
          return (
            <article key={d.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="mono muted">#{d.id.slice(2, 10)} · {d.size.toLocaleString()} B · block {d.block}</span>
                <a className="mono amber hover:underline" href={txUrl(d.cosmosTx, d.block)} target="_blank" rel="noreferrer">{short(d.tx, 8, 6)}</a>
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
