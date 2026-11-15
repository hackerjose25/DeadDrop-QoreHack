"use client";
// Browser-side crypto. Plaintext and secret keys never leave this module's caller (the user's device).
import { seal, open, verifyRecipientCard, deriveSealKeys, type RecipientCard, type SealKeyPair } from "@qorechain/qoreseal";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { CHAIN_ID, PURPOSE } from "./config";

export const hex = (b: Uint8Array) => "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const unhex = (h: string) => { const s = h.replace(/^0x/, ""); return new Uint8Array(s.match(/.{2}/g)!.map((x) => parseInt(x, 16))); };
export const b64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
export const sha3hex = (b: Uint8Array) => hex(sha3_256(b));
export const fingerprint = (key: Uint8Array) => sha3hex(key).slice(2, 18);

export type RecipientWithKeys = { id: string; name: string; address: string; card: RecipientCard; keys: { pqPublicKey: string; mlkemPublicKey: string | null } };

/** Verify a recipient's signed QoreSeal card against their on-chain ML-DSA-87 + ML-KEM-1024 keys. Throws if forged. */
export function verifiedRecipient(r: RecipientWithKeys) {
  if (!r.keys.mlkemPublicKey) throw new Error(`${r.name} has no ML-KEM key on chain`);
  return verifyRecipientCard({
    card: r.card, chainId: CHAIN_ID, address: r.address,
    pqPublicKey: unhex(r.keys.pqPublicKey), mlkemPublicKey: unhex(r.keys.mlkemPublicKey),
  });
}

// Payload = "DDv1" | u32 headerLen | JSON header {name,type,size} | file bytes — so the filename is sealed too.
const MAGIC = new TextEncoder().encode("DDv1");

export function packFile(name: string, type: string, bytes: Uint8Array, note?: string) {
  const header = new TextEncoder().encode(JSON.stringify({ name, type, size: bytes.length, note: note || undefined }));
  const out = new Uint8Array(4 + 4 + header.length + bytes.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(4, header.length);
  out.set(header, 8);
  out.set(bytes, 8 + header.length);
  return out;
}

export function unpackFile(payload: Uint8Array) {
  if (new TextDecoder().decode(payload.subarray(0, 4)) !== "DDv1") return { name: "message.txt", type: "text/plain", note: undefined as string | undefined, bytes: payload };
  const len = new DataView(payload.buffer, payload.byteOffset).getUint32(4);
  const header = JSON.parse(new TextDecoder().decode(payload.subarray(8, 8 + len))) as { name: string; type: string; note?: string };
  return { ...header, bytes: payload.subarray(8 + len) };
}

/** Seal a payload to every verified recipient (one envelope, many recipients). */
export function sealDrop(payload: Uint8Array, recipients: RecipientWithKeys[]) {
  const envelope = seal({ chainId: CHAIN_ID, purpose: PURPOSE, recipients: recipients.map(verifiedRecipient), plaintext: payload });
  const id = new Uint8Array(32); crypto.getRandomValues(id);
  return { envelope, id: hex(id), sha3: sha3hex(envelope) };
}

export const keysFromPhrase = (mnemonic: string): SealKeyPair => deriveSealKeys({ mnemonic: mnemonic.trim().toLowerCase().replace(/\s+/g, " ") });

export function openDrop(envelope: Uint8Array, keys: SealKeyPair) {
  return unpackFile(open({ chainId: CHAIN_ID, purpose: PURPOSE, envelope, keys }));
}
