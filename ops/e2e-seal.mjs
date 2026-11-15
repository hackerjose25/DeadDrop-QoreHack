// node e2e-seal.mjs — end-to-end crypto check, nothing sent on chain:
// seal to journalist + editor (keys + cards resolved on chain) → both open → outsider fails → 1-byte tamper fails.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { deriveSealKeys, generateSealKeys, open, envelopeToText, envelopeFromText } from "@qorechain/qoreseal";
import { sealToAddresses } from "@qorechain/qoreseal/network";
import { loadAccount, NET } from "./lib.mjs";

const PURPOSE = "deaddrop/v1";
const card = (r) => JSON.parse(fs.readFileSync(new URL(`./cards/${r}.json`, import.meta.url)));
const j = await loadAccount("journalist");
const e = await loadAccount("editor");

const plaintext = new TextEncoder().encode("CONFIDENTIAL: internal memo — test evidence for Dead Drop e2e");
const envelope = await sealToAddresses({
  rest: NET.rest, chainId: NET.chainId, purpose: PURPOSE, plaintext,
  recipients: [{ address: j.cosmos, card: card("journalist") }, { address: e.cosmos, card: card("editor") }],
});
const text = envelopeToText(envelope);
const sha3 = createHash("sha3-256").update(envelope).digest("hex");
console.log(`sealed ${plaintext.length} B → envelope ${envelope.length} B (text ${text.length} chars), sha3-256 ${sha3.slice(0, 16)}…`);

const tryOpen = (label, keys, env = envelope) => {
  try {
    const out = open({ chainId: NET.chainId, purpose: PURPOSE, envelope: env, keys });
    console.log(`  ✓ ${label} opened: "${new TextDecoder().decode(out).slice(0, 40)}…"`);
  } catch (err) {
    console.log(`  ✗ ${label} refused (${err.code ?? err.message})`);
  }
};
tryOpen("journalist", deriveSealKeys({ mnemonic: process.env.JOURNALIST_MNEMONIC.trim() }));
tryOpen("editor", deriveSealKeys({ mnemonic: process.env.EDITOR_MNEMONIC.trim() }));
tryOpen("outsider", generateSealKeys());
const tampered = envelopeFromText(text); tampered[tampered.length - 5] ^= 1;
tryOpen("journalist on 1-byte-tampered envelope", deriveSealKeys({ mnemonic: process.env.JOURNALIST_MNEMONIC.trim() }), tampered);
