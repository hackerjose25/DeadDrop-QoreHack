// node setup-recipient.mjs <journalist|editor>
// Makes an account able to RECEIVE Dead Drop submissions:
//  1) derives QoreSeal keys from the account mnemonic (QoreSeal spec: sealSeedFromMnemonic → ML-KEM-1024 + X25519)
//  2) registers the ML-KEM-1024 key in the on-chain KEM registry (hybrid-signed)
//  3) signs a QoreSeal recipient card with the account's ECDSA + ML-DSA-87 keys (QoreSign) → cards/<role>.json (public)
//  4) verifies the card end to end the way a sender will: resolveRecipient() against the chain
import fs from "node:fs";
import { deriveSealKeys, signRecipientCard, toHex } from "@qorechain/qoreseal";
import { fetchKemKey, resolveRecipient } from "@qorechain/qoreseal/network";
import { classicalKeyFromPrivate } from "@qorechain/qoresign";
import { derivePqcCanonical, msg, KEM_ALGORITHM_ML_KEM_1024 } from "@qorechain/sdk";
import { createHash } from "node:crypto";
import { roleArg, loadAccount, send, NET } from "./lib.mjs";

const role = roleArg();
const acc = await loadAccount(role);
const mnemonic = process.env[`${role.toUpperCase()}_MNEMONIC`].trim();
const keys = deriveSealKeys({ mnemonic, index: 0 });
const fp = createHash("sha3-256").update(keys.mlkemPublicKey).digest("hex");
console.log(`${role} ${acc.cosmos}\n  ML-KEM-1024 key fingerprint (sha3-256): ${fp.slice(0, 16)}…`);

// 2) KEM registry
const existing = await fetchKemKey({ rest: NET.rest, address: acc.cosmos }).catch(() => null);
if (existing && existing.found !== false && !process.argv.includes("--rekey")) {
  console.log("  KEM key already registered (resolveRecipient below checks it matches)");
} else {
  const m = msg.pqc.registerKemKey({ sender: acc.cosmos, algorithmId: KEM_ALGORITHM_ML_KEM_1024, publicKey: keys.mlkemPublicKey });
  try {
    const res = await send(acc, [m], 600_000, "hybrid");
    console.log(`  registered KEM key  tx ${res.transactionHash}`);
  } catch (e) {
    if (!/already publishes exactly this key/.test(String(e?.rawLog ?? e?.message ?? e))) throw e;
    console.log("  KEM key already registered on chain (exact match)");
  }
}

// 3) Recipient card
const card = signRecipientCard({
  chainId: NET.chainId,
  address: acc.cosmos,
  keys,
  classicalKey: classicalKeyFromPrivate(typeof acc.privateKey === "string" ? Buffer.from(acc.privateKey.replace(/^0x/, ""), "hex") : acc.privateKey, "eth_secp256k1"),
  pqKey: derivePqcCanonical(acc.cosmos, mnemonic),
});
fs.mkdirSync(new URL("./cards/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`./cards/${role}.json`, import.meta.url), JSON.stringify(card, null, 2));
console.log(`  signed recipient card → ops/cards/${role}.json`);

// 4) Verify like a sender would
await resolveRecipient({ rest: NET.rest, chainId: NET.chainId, address: acc.cosmos, card });
console.log("  ✓ card verified against on-chain ML-DSA-87 + ML-KEM-1024 keys");
