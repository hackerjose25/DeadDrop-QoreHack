"use client";
import { useState } from "react";
import Link from "next/link";
import { UserPlus, Loader2, CheckCircle2, XCircle, Circle, Copy, Inbox, KeyRound } from "lucide-react";
import { CHAIN_ID, short, EXPLORER } from "@/lib/config";
import { keysFromPhrase, hex, fingerprint } from "@/lib/crypto";

type Step = { label: string; state: "todo" | "busy" | "ok" | "fail"; detail?: string };
const GAS = 600_000, PQC_GAS = 700_000, GAS_PRICE = 0.15; // uqor per gas — fee ≈ 0.09 QOR

async function chain(path: string) {
  const r = await fetch(`/api/chain/${path}`, { cache: "no-store" });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}
const b64ToHex = (s: string) => Array.from(atob(s), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");

export default function Become() {
  const [phrase, setPhrase] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ address: string; evm: string; fp: string; tx?: string; already: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (i: number, s: Partial<Step>) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, ...s } : x)));

  async function go() {
    setBusy(true); setDone(null);
    const words = phrase.trim().toLowerCase().replace(/\s+/g, " ");
    setPhrase(""); // never keep the words around
    setSteps([
      { label: "Derive your wallet and inbox keys on this device", state: "busy" },
      { label: "Check it's a verified Qore wallet (ML-DSA-87 key on chain)", state: "todo" as const },
      { label: "Register your ML-KEM-1024 inbox key on QoreChain", state: "todo" },
    ]);
    let i = 0;
    try {
      const sdk = await import("@qorechain/sdk");
      const acc = await sdk.deriveUnifiedAccount(words);
      const keys = keysFromPhrase(words);
      const fp = fingerprint(keys.mlkemPublicKey);
      set(0, { state: "ok", detail: `${short(acc.cosmos, 10, 6)} · inbox key ${fp}` });

      // Signed here; our server only forwards the bytes because the testnet RPC has no CORS.
      const transport = {
        broadcastTx: async (tx: Uint8Array) => {
          let s = ""; tx.forEach((x) => (s += String.fromCharCode(x)));
          const r = await fetch("/api/broadcast", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: btoa(s) }) });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          return j;
        },
      };
      i = 1; set(1, { state: "busy" });
      const [pq, bal, kem] = await Promise.all([
        chain(`qorechain/pqc/v1/account/${acc.cosmos}`),
        chain(`cosmos/bank/v1beta1/balances/${acc.cosmos}`),
        chain(`qorechain/pqc/v1/kem/${acc.cosmos}`),
      ]);
      let uqor = Number((bal.body.balances ?? []).find((b: { denom: string }) => b.denom === "uqor")?.amount ?? 0);
      const pqKey = pq.ok ? (pq.body.account ?? pq.body)?.public_key : null;
      const kemFee = Math.ceil(GAS * GAS_PRICE), pqcFee = Math.ceil(PQC_GAS * GAS_PRICE);
      if (pqKey) {
        set(1, { state: "ok", detail: `${(pq.body.account ?? pq.body).algorithm_name ?? "ML-DSA-87"} registered · balance ${(uqor / 1e6).toFixed(3)} QOR` });
      } else {
        // Not yet post-quantum: register the wallet's ML-DSA-87 key (with proof of possession), signed classically — the chain's bootstrap path.
        if (uqor < kemFee + pqcFee) throw new Error(`This wallet has ${(uqor / 1e6).toFixed(3)} QOR; it needs about ${((kemFee + pqcFee) / 1e6).toFixed(2)} QOR to register its post-quantum key and inbox key. Top it up from the QoreChain faucet, then retry.`);
        set(1, { label: "Make it a verified Qore wallet: register its ML-DSA-87 key", detail: "not registered yet — registering now (proof of possession)…" });
        const a0 = await chain(`cosmos/auth/v1beta1/accounts/${acc.cosmos}`);
        const b0 = a0.body.account?.base_account ?? a0.body.account;
        if (!b0) throw new Error("Account not found on chain — fund it first.");
        const proofOfPossession = sdk.signProofOfPossession({ chainId: CHAIN_ID, account: acc.cosmos, keypair: acc.pqc });
        const ecdsa = Uint8Array.from(acc.publicKey.replace(/^0x/, "").match(/.{2}/g)!.map((x) => parseInt(x, 16)));
        const m0 = sdk.buildRegisterPqcKeyMsg(acc.cosmos, { pqcKeypair: acc.pqc, ecdsaPubkey: ecdsa, keyType: "hybrid", proofOfPossession });
        const r0 = await new sdk.EthNativeSigner(acc, { signMode: "classical" }).signAndBroadcast(transport, {
          chainId: CHAIN_ID, accountNumber: BigInt(b0.account_number), sequence: BigInt(b0.sequence || 0), messages: [m0],
          fee: { amount: [{ denom: "uqor", amount: String(pqcFee) }], gas: String(PQC_GAS) },
        });
        if (r0.code !== 0) throw new Error(`Chain rejected the ML-DSA-87 registration (code ${r0.code}): ${r0.rawLog ?? ""}`);
        uqor -= pqcFee;
        set(1, { state: "ok", detail: `ML-DSA-87 key registered · tx ${short(r0.transactionHash, 8, 6)}` });
        await new Promise((r) => setTimeout(r, 2500)); // let the next block land before the hybrid-signed tx
      }

      i = 2; set(2, { state: "busy" });
      const mine = hex(keys.mlkemPublicKey).slice(2);
      if (kem.body.found && kem.body.key?.public_key && b64ToHex(kem.body.key.public_key) === mine) {
        set(2, { state: "ok", detail: "Already registered — you're a recipient." });
        setDone({ address: acc.cosmos, evm: acc.evm, fp, already: true });
        return;
      }
      const fee = kemFee;
      if (uqor < fee) throw new Error(`Needs about ${(fee / 1e6).toFixed(2)} QOR for the fee. Top up from the QoreChain faucet, then retry.`);
      const a = await chain(`cosmos/auth/v1beta1/accounts/${acc.cosmos}`);
      const base = a.body.account?.base_account ?? a.body.account;
      if (!base) throw new Error("Account not found on chain — fund it first.");
      const msg = sdk.msg.pqc.registerKemKey({ sender: acc.cosmos, algorithmId: sdk.KEM_ALGORITHM_ML_KEM_1024, publicKey: keys.mlkemPublicKey });
      const signer = new sdk.EthNativeSigner(acc, { signMode: "hybrid", rest: `${location.origin}/api/chain` });
      const res = await signer.signAndBroadcast(transport, {
        chainId: CHAIN_ID, accountNumber: BigInt(base.account_number), sequence: BigInt(base.sequence || 0), messages: [msg],
        fee: { amount: [{ denom: "uqor", amount: String(fee) }], gas: String(GAS) },
      });
      if (res.code !== 0) throw new Error(`Chain rejected the registration (code ${res.code}): ${res.rawLog ?? ""}`);
      set(2, { state: "ok", detail: `tx ${short(res.transactionHash, 8, 6)}` });
      setDone({ address: acc.cosmos, evm: acc.evm, fp, tx: res.transactionHash, already: false });
    } catch (e) {
      set(i, { state: "fail", detail: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  const link = done ? `${typeof location !== "undefined" ? location.origin : ""}/submit?to=${done.address}` : "";

  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-4">
      <div className="panel p-6">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(245,185,66,.12)", color: "var(--amber)" }}><UserPlus size={22} /></span>
        <h1 className="text-2xl font-extrabold">Become a recipient</h1>
        <p className="mt-1 text-sm muted">Turn any verified Qore wallet into a Dead Drop inbox. This publishes one thing on QoreChain: your <b className="text-[var(--ink)]">ML-KEM-1024 public key</b>, in a transaction signed by your wallet&apos;s ECDSA + ML-DSA-87 keys, so the chain itself vouches that the key is yours. After that, anyone can seal files that only you can open.</p>

        {!done && (
          <>
            <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} rows={4} spellCheck={false} autoComplete="off" disabled={busy}
              placeholder="your wallet's recovery phrase (stays on this device)" className="mono mt-4 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-amber-400/60" />
            <button className="btn btn-amber mt-4 w-full justify-center" disabled={busy || phrase.trim().split(/\s+/).length < 12} onClick={go}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Register my inbox key
            </button>
            <p className="mt-2 text-[11px] muted">Signed in your browser; the phrase is cleared immediately and never sent. Fee ≈ 0.09 QOR (+0.11 QOR if your wallet still needs its post-quantum key).</p>
          </>
        )}

        {steps.length > 0 && (
          <ol className="mt-5 space-y-3">
            {steps.map((s, k) => (
              <li key={k} className="flex gap-3 text-sm">
                <span className="mt-0.5 shrink-0">
                  {s.state === "busy" ? <Loader2 size={16} className="animate-spin amber" /> : s.state === "ok" ? <CheckCircle2 size={16} className="text-green-400" /> : s.state === "fail" ? <XCircle size={16} className="text-red-400" /> : <Circle size={16} className="muted" />}
                </span>
                <span>
                  <span className={s.state === "todo" ? "muted" : ""}>{s.label}</span>
                  {s.detail && <span className={`mono mt-0.5 block text-[11px] ${s.state === "fail" ? "text-red-300" : "muted"}`}>{s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {steps.some((s) => s.state === "fail") && !busy && <button className="btn btn-ghost mt-4 text-sm" onClick={() => setSteps([])}>Try again</button>}

        {done && (
          <div className="mt-5 rounded-xl border border-green-400/25 bg-green-400/5 p-4">
            <p className="font-semibold text-green-300">{done.already ? "You're already a recipient." : "You're a recipient."}</p>
            <p className="mt-1 text-sm muted">Share this link. Whoever opens it can seal a drop to you, and they&apos;ll see your inbox key fingerprint <span className="mono text-[var(--ink)]">{done.fp}</span> to compare with you out-of-band.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="mono min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 text-xs">{link}</code>
              <button className="btn btn-ghost text-sm" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href="/inbox" className="btn btn-amber text-sm"><Inbox size={15} /> Open my inbox</Link>
              {done.tx && <a className="btn btn-ghost text-sm" href={`${EXPLORER}/tx/${done.tx}`} target="_blank" rel="noreferrer">View registration tx</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
