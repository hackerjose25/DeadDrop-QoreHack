// Shared (client + server) configuration. Public values only.
import journalistCard from "./cards/journalist.json";
import editorCard from "./cards/editor.json";
import type { RecipientCard } from "@qorechain/qoreseal";

export const CHAIN_ID = "qorechain-diana";
export const REST = "https://api-testnet.qore.host";
export const EVM_RPC = "https://evm-testnet.qore.host";
export const EXPLORER = "https://explore.qore.network";
export const PURPOSE = "deaddrop/v1";
export const DEADDROP = "0xae3fac004379519392da56bfd7421ef93246e389" as const;
export const DEPLOY_BLOCK = BigInt(10114889);
export const SCHEME = "QoreSeal v1 · ML-KEM-1024 + X25519 · AES-256-GCM";

export type Recipient = { id: string; name: string; role: string; address: string; evm: `0x${string}`; card: RecipientCard };

export const RECIPIENTS: Recipient[] = [
  { id: "journalist", name: "Maya Iyer", role: "Investigative journalist", address: journalistCard.address, evm: "0x644dB59703E9843b3A01926f6c2645abDF2F15a3", card: journalistCard as RecipientCard },
  { id: "editor", name: "Daniel Okafor", role: "Editor-in-chief", address: editorCard.address, evm: "0xb9456A3690B3fC18B79211A22C665e6D010B600C", card: editorCard as RecipientCard },
];

/** Explorer link for a tx: the explorer indexes by Cosmos hash (no 0x); fall back to the block page. */
export const txUrl = (cosmosTx?: string | null, block?: number) => (cosmosTx ? `${EXPLORER}/tx/${cosmosTx}` : block ? `${EXPLORER}/block/${block}` : EXPLORER);

export const short = (s: string, a = 6, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
