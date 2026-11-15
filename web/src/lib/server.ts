// Server-only chain access: key lookups, the relayer, drop listings. Never import from client components.
import "server-only";
import { createPublicClient, createWalletClient, http, defineChain, hexToBytes, toHex, type Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sha3_256 } from "@noble/hashes/sha3.js";
import abiJson from "./deadDropAbi.json";
import { DEADDROP, DEPLOY_BLOCK, EVM_RPC, REST, RECIPIENTS } from "./config";
import { ensureWindow, isWindowError } from "./window";
import { qorToEvm, evmToQor } from "@qorechain/sdk";

const abi = abiJson as Abi;
const chain = defineChain({ id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: [EVM_RPC] } } });
export const pub = createPublicClient({ chain, transport: http(EVM_RPC, { retryCount: 4, retryDelay: 600 }) });

/** fetch with retries — the testnet REST endpoint occasionally drops a request. */
async function getJson(path: string) {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${REST}${path}`, { cache: "no-store" });
      if (r.ok) return r.json();
      last = new Error(`${path}: HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  throw last;
}

/** On-chain keys a sender needs to verify a recipient card in the browser (base64 → hex). */
export async function recipientKeys(address: string) {
  const [acc, kem] = await Promise.all([getJson(`/qorechain/pqc/v1/account/${address}`), getJson(`/qorechain/pqc/v1/kem/${address}`)]);
  const a = acc.account ?? acc;
  const b64hex = (s: string) => Buffer.from(s, "base64").toString("hex");
  return {
    pqPublicKey: b64hex(a.public_key),
    pqAlgorithm: a.algorithm_name as string,
    possessionProven: !!a.possession_proven,
    mlkemPublicKey: kem.found ? b64hex(kem.key.public_key) : null,
  };
}

export type ResolvedRecipient = { id: string; name: string; role: string; address: string; evm: `0x${string}`; card: (typeof RECIPIENTS)[number]["card"] | null; curated: boolean; keys: Awaited<ReturnType<typeof recipientKeys>> };

/**
 * Resolve a curated id ("journalist"), or ANY QoreChain address (qor1… or 0x…) that has registered an ML-KEM-1024 key.
 * The KEM key was registered by a hybrid-signed (ECDSA + ML-DSA-87) tx from that account, so the chain itself binds key ↔ address.
 */
export async function resolveRecipient(idOrAddress: string): Promise<ResolvedRecipient> {
  const s = idOrAddress.trim();
  const cur = RECIPIENTS.find((r) => r.id === s || r.address === s || r.evm.toLowerCase() === s.toLowerCase());
  if (cur) return { ...cur, curated: true, keys: await recipientKeys(cur.address) };
  let address: string, evm: `0x${string}`;
  try {
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) { evm = s as `0x${string}`; address = evmToQor(s); }
    else if (/^qor1[0-9a-z]{38,}$/.test(s)) { address = s; evm = qorToEvm(s) as `0x${string}`; }
    else throw 0;
  } catch { throw new Error("Not a QoreChain address (expected qor1… or 0x…)."); }
  let keys: Awaited<ReturnType<typeof recipientKeys>>;
  try { keys = await recipientKeys(address); }
  catch { throw new Error("This wallet has no ML-DSA-87 (post-quantum) key on chain yet, so it isn't a verified Qore wallet."); }
  if (!keys.mlkemPublicKey) throw new Error("This wallet hasn't become a Dead Drop recipient yet (no ML-KEM key on chain). Send them to /become.");
  return { id: address, name: `${address.slice(0, 10)}…${address.slice(-4)}`, role: "Independent recipient", address, evm, card: null, curated: false, keys };
}

/** Broadcast a tx signed in the user's browser (the testnet RPC has no CORS). Only KEM-key registrations are accepted. */
export async function broadcastSigned(txBytes: Uint8Array) {
  const { TxRaw, TxBody } = await import("cosmjs-types/cosmos/tx/v1beta1/tx");
  const body = TxBody.decode(TxRaw.decode(txBytes).bodyBytes);
  if (!body.messages.length || body.messages.some((m) => m.typeUrl !== "/qorechain.pqc.v1.MsgRegisterKEMKey")) throw new Error("only ML-KEM key registrations can be broadcast here");
  const { StargateClient } = await import("@cosmjs/stargate");
  const client = await StargateClient.connect("https://rpc-testnet.qore.host");
  try {
    const r = await client.broadcastTx(txBytes, 60_000);
    return { code: r.code, transactionHash: r.transactionHash, height: r.height, rawLog: r.rawLog };
  } finally { client.disconnect(); }
}

/** The explorer indexes txs by their Cosmos hash; map an EVM tx hash to it (null if not indexed yet). */
const cosmosCache = new Map<string, string>();
export async function cosmosTxHash(evmHash: string): Promise<string | null> {
  if (cosmosCache.has(evmHash)) return cosmosCache.get(evmHash)!;
  for (let i = 0; i < 4; i++) {
    try {
      const q = encodeURIComponent(`ethereum_tx.ethereumTxHash='${evmHash}'`);
      const r = await fetch(`${REST}/cosmos/tx/v1beta1/txs?query=${q}&events=${q}`, { cache: "no-store" });
      if (r.ok) {
        const h = (await r.json()).tx_responses?.[0]?.txhash as string | undefined;
        if (h) { cosmosCache.set(evmHash, h); return h; }
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}

function relayerWallet() {
  const pk = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY is not set on the server");
  return createWalletClient({ account: privateKeyToAccount(pk), chain, transport: http(EVM_RPC, { retryCount: 2 }) });
}

/** Relay a sealed envelope. The server recomputes the hash itself; it never sees plaintext. */
export async function relay(id: Hex, recipientIds: string[], envelope: Uint8Array) {
  if (!recipientIds.length || recipientIds.length > 16) throw new Error("1–16 recipients required");
  const recips = await Promise.all([...new Set(recipientIds)].map(resolveRecipient));
  if (envelope.length > 48 * 1024) throw new Error("envelope too large for inline submission (48 KB)");
  const envelopeSha3 = toHex(sha3_256(envelope));
  const wallet = relayerWallet();
  const { request } = await pub.simulateContract({
    address: DEADDROP, abi, functionName: "submit", account: wallet.account,
    args: [id, recips.map((r) => r.evm), envelopeSha3, envelope.length, "", toHex(envelope)],
  });
  // The EVM window expires daily; renew it if low, and once more if the node still rejects the tx.
  await ensureWindow().catch(() => { /* status check failed — try the send anyway */ });
  let hash: Hex;
  try { hash = await wallet.writeContract(request); }
  catch (e) {
    if (!isWindowError(e)) throw e;
    await ensureWindow(true);
    hash = await wallet.writeContract(request);
  }
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`submit reverted: ${hash}`);
  const block = await pub.getBlock({ blockNumber: receipt.blockNumber });
  return {
    submissionId: id, envelopeSha3, size: envelope.length, recipients: recips.map((r) => r.address),
    contract: DEADDROP, tx: hash, cosmosTx: await cosmosTxHash(hash), block: Number(receipt.blockNumber), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}

export type Drop = { id: Hex; recipients: string[]; envelopeSha3: Hex; size: number; envelope: Hex; tx: Hex; cosmosTx: string | null; block: number; timestamp: string | null; acknowledged: boolean };

/** All drops addressed to `evm`, newest first, with the inline envelope bytes. */
export async function dropsFor(evm: `0x${string}`): Promise<Drop[]> {
  // The node caps eth_getLogs at 10,000 blocks per query, so page through in chunks.
  const latest = await pub.getBlockNumber();
  const STEP = BigInt(9000);
  const ranges: [bigint, bigint][] = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += STEP + BigInt(1)) ranges.push([from, from + STEP > latest ? latest : from + STEP]);
  const logs = (await Promise.all(ranges.map(([fromBlock, toBlock]) =>
    pub.getContractEvents({ address: DEADDROP, abi, eventName: "Submitted", fromBlock, toBlock })))).flat();
  const mine = logs.filter((l) => ((l as unknown as { args: { recipients: string[] } }).args.recipients ?? []).some((r) => r.toLowerCase() === evm.toLowerCase()));
  const out = await Promise.all(mine.map(async (l) => {
    const a = (l as unknown as { args: { id: Hex; recipients: string[]; envelopeSha3: Hex; size: number; envelope: Hex } }).args;
    const [blk, ack, cosmosTx] = await Promise.all([
      pub.getBlock({ blockNumber: l.blockNumber! }).catch(() => null),
      pub.readContract({ address: DEADDROP, abi, functionName: "acknowledged", args: [a.id, evm] }).catch(() => false) as Promise<boolean>,
      cosmosTxHash(l.transactionHash!),
    ]);
    return { id: a.id, recipients: a.recipients, envelopeSha3: a.envelopeSha3, size: Number(a.size), envelope: a.envelope, tx: l.transactionHash!, cosmosTx, block: Number(l.blockNumber), timestamp: blk ? new Date(Number(blk.timestamp) * 1000).toISOString() : null, acknowledged: ack };
  }));
  return out.reverse();
}

/** Proof of Silence check: is (id, sha3) anchored? Plus the stored submission. */
export async function verifyReceipt(id: Hex, envelopeSha3: Hex) {
  const [matches, s] = await Promise.all([
    pub.readContract({ address: DEADDROP, abi, functionName: "matches", args: [id, envelopeSha3] }) as Promise<boolean>,
    pub.readContract({ address: DEADDROP, abi, functionName: "submissions", args: [id] }) as Promise<[Hex, Hex, number, bigint, bigint, boolean]>,
  ]);
  return { matches, anchored: s[3] > BigInt(0), envelopeSha3: s[0], size: Number(s[2]), block: Number(s[3]), timestamp: s[4] > BigInt(0) ? new Date(Number(s[4]) * 1000).toISOString() : null, inline: s[5] };
}

export const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
export { hexToBytes };
