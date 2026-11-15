// Keeps the relayer's QoreChain EVM authorisation window open. The chain caps a window at 17,280 blocks
// (~1 day), so instead of reopening it by hand, the relay renews it whenever it runs low.
// Opening a window is a hybrid (ECDSA + ML-DSA-87) Cosmos tx, so this needs RELAYER_MNEMONIC on the server.
import "server-only";
import { DEADDROP, REST } from "./config";

const RPC = "https://rpc-testnet.qore.host";
const CHAIN_ID = "qorechain-diana";
const RELAYER_COSMOS = "qor15twnl6d0f2uqpukq4mkkzt9lj69g3hjv6w2fll";

// Renew when fewer than this remain (blocks ≈ 1.5 h, so a renewal never races a send).
const MIN_BLOCKS = 1000, MIN_TXS = 20, MIN_VALUE_UQOR = 1_000_000;
// What a renewal grants. Always scoped to the DeadDrop contract only.
const BLOCKS = 17280, TXS = 500, VALUE_UQOR = "10000000";

type WindowStatus = { live: boolean; remaining_blocks: string; remaining_txs: string; remaining_value: string; allowed_targets: string[] };

export async function windowStatus(): Promise<WindowStatus> {
  const r = await fetch(`${REST}/qorechain/pqc/v1/evm_window/${RELAYER_COSMOS}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`evm_window: HTTP ${r.status}`);
  return r.json();
}

function needsRenewal(w: WindowStatus) {
  return !w.live
    || Number(w.remaining_blocks) < MIN_BLOCKS
    || Number(w.remaining_txs) < MIN_TXS
    || Number(w.remaining_value || 0) < MIN_VALUE_UQOR
    || !w.allowed_targets?.some((t) => t.toLowerCase() === DEADDROP.toLowerCase());
}

async function openWindow() {
  const mnemonic = process.env.RELAYER_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("RELAYER_MNEMONIC is not set on the server; cannot renew the EVM window");
  const { deriveUnifiedAccount, EthNativeSigner, openEvmWindowMsg } = await import("@qorechain/sdk");
  const { StargateClient } = await import("@cosmjs/stargate");
  const acc = await deriveUnifiedAccount(mnemonic);
  if (acc.cosmos !== RELAYER_COSMOS) throw new Error("RELAYER_MNEMONIC does not belong to the relayer account");

  const a = await (await fetch(`${REST}/cosmos/auth/v1beta1/accounts/${acc.cosmos}`, { cache: "no-store" })).json();
  const base = a.account.base_account || a.account;
  const msg = openEvmWindowMsg({ sender: acc.cosmos, blocks: BLOCKS, maxTxs: TXS, maxValue: VALUE_UQOR, allowedTargets: [DEADDROP] });
  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: REST });
  const client = await StargateClient.connect(RPC);
  try {
    const gas = 500_000;
    const res = await signer.signAndBroadcast(client, {
      chainId: CHAIN_ID, accountNumber: BigInt(base.account_number), sequence: BigInt(base.sequence || 0), messages: [msg],
      fee: { amount: [{ denom: "uqor", amount: String(Math.ceil(gas * 0.15)) }], gas: String(gas) },
    });
    if (res.code !== 0) throw new Error(`open EVM window failed: code=${res.code} ${res.rawLog ?? ""}`);
  } finally { client.disconnect(); }
}

let inflight: Promise<void> | null = null;

/** Make sure the window can admit a relay. `force` renews regardless (used after a rejected tx). */
export async function ensureWindow(force = false) {
  if (!force && !needsRenewal(await windowStatus())) return;
  inflight ??= openWindow().finally(() => { inflight = null; });
  await inflight;
  // Wait until the node reports the new window as live (usually the next block).
  for (let i = 0; i < 15; i++) {
    if (!needsRenewal(await windowStatus().catch(() => ({ live: false } as WindowStatus)))) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export const isWindowError = (e: unknown) => /authorisation window/i.test(String((e as { details?: string })?.details ?? e));
