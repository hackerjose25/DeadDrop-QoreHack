"use client";
// Inbox vault: after a one-time setup with the recovery phrase, only the derived QoreSeal decryption keys are kept on
// this device, AES-256-GCM encrypted. The wrapping key comes from a passkey (WebAuthn PRF: fingerprint / Face ID / PIN)
// or, where PRF isn't supported, from a password (PBKDF2-SHA256). The recovery phrase itself is never stored.
// What's stored can only read drops: it can't sign, move funds, or change on-chain keys.
import type { SealKeyPair } from "@qorechain/qoreseal";
import { hex, unhex, b64 } from "./crypto";

const STORE = "deaddrop.vault.v1";
const FIELDS = ["seed", "mlkemPublicKey", "mlkemSecretKey", "x25519PublicKey", "x25519SecretKey"] as const;
const PRF_SALT = new TextEncoder().encode("dead-drop/inbox-vault/v1");
const PBKDF2_ITERS = 600_000;

export type Vault = {
  kind: "passkey" | "password";
  recipientId: string; name: string;
  credId?: string; salt?: string; // passkey credential id (b64url) / password salt (hex)
  iv: string; ct: string;           // hex
};

const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const buf = (u: Uint8Array) => u.slice().buffer as ArrayBuffer;

export function loadVault(): Vault | null {
  try { const s = localStorage.getItem(STORE); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function forgetVault() { try { localStorage.removeItem(STORE); } catch { /* storage blocked */ } }
function saveVault(v: Vault) {
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { throw new Error("This browser blocks local storage (private window?) — can't remember the inbox here."); }
}

async function aesFromBytes(bytes: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", buf(bytes), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: buf(PRF_SALT), info: new TextEncoder().encode("aes-gcm") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function aesFromPassword(pw: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations: PBKDF2_ITERS },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptKeys(aes: CryptoKey, keys: SealKeyPair) {
  const iv = rnd(12);
  const plain = new TextEncoder().encode(JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f, hex(keys[f])]))));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, aes, buf(plain)));
  plain.fill(0);
  return { iv: hex(iv), ct: hex(ct) };
}
async function decryptKeys(aes: CryptoKey, v: Vault): Promise<SealKeyPair> {
  let plain: Uint8Array;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(unhex(v.iv)) }, aes, buf(unhex(v.ct)))); }
  catch { throw new Error(v.kind === "password" ? "Wrong password." : "This passkey can't unlock the inbox."); }
  const o = JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
  plain.fill(0);
  return Object.fromEntries(FIELDS.map((f) => [f, unhex(o[f])])) as unknown as SealKeyPair;
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

/** Is a platform passkey (fingerprint / Face ID / Windows Hello) available here? PRF support is only known after creation. */
export async function passkeyAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

async function prfGet(credId: Uint8Array) {
  const a = (await navigator.credentials.get({
    publicKey: {
      challenge: rnd(32), userVerification: "required", timeout: 60_000,
      allowCredentials: [{ type: "public-key", id: buf(credId) }],
      extensions: { prf: { eval: { first: buf(PRF_SALT) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const out = (a?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
  if (!out) throw new Error("This passkey doesn't support the PRF extension needed to unlock — use a password instead.");
  return new Uint8Array(out);
}

/** Create a passkey and seal the keys under it. Throws a clear error if the authenticator lacks PRF. */
export async function setupPasskey(keys: SealKeyPair, who: { id: string; name: string }) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: rnd(32),
      rp: { name: "Dead Drop" },
      user: { id: buf(rnd(16)), name: `${who.name} · inbox`, displayName: `${who.name} (Dead Drop inbox)` },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey creation was cancelled.");
  if (!(cred.getClientExtensionResults() as PrfResults).prf?.enabled) throw new Error("This device's passkeys don't support PRF — use a password instead.");
  const credId = new Uint8Array(cred.rawId);
  const secret = await prfGet(credId); // second prompt: PRF output is only returned on an assertion in most browsers
  const enc = await encryptKeys(await aesFromBytes(secret), keys);
  secret.fill(0);
  saveVault({ kind: "passkey", recipientId: who.id, name: who.name, credId: b64(credId), ...enc });
}

export async function setupPassword(keys: SealKeyPair, who: { id: string; name: string }, pw: string) {
  if (pw.length < 10) throw new Error("Use at least 10 characters.");
  const salt = rnd(16);
  const enc = await encryptKeys(await aesFromPassword(pw, salt), keys);
  saveVault({ kind: "password", recipientId: who.id, name: who.name, salt: hex(salt), ...enc });
}

export async function unlockVault(v: Vault, pw?: string): Promise<SealKeyPair> {
  if (v.kind === "passkey") {
    const secret = await prfGet(fromB64(v.credId!));
    try { return await decryptKeys(await aesFromBytes(secret), v); } finally { secret.fill(0); }
  }
  return decryptKeys(await aesFromPassword(pw ?? "", unhex(v.salt!)), v);
}
