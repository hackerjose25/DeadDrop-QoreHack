# Dead Drop

**Expose the truth without exposing the source.** Post-quantum whistleblowing on QoreChain. A source seals evidence **in their own browser** to a recipient's on-chain ML-KEM-1024 key. A relayer posts the sealed envelope on-chain, so the source never needs a wallet. Only the recipient can open it.

Built for **Build Before Q-Day** (QoreChain Developer Fest 2026) on the `qorechain-diana` testnet (EVM chain 9800).

- **Live demo:** https://dead-drop-eta.vercel.app
- **Contract:** [`0xae3fac004379519392da56bfd7421ef93246e389`](https://explore.qore.network) (`DeadDrop.sol`)

## Why
"Harvest now, decrypt later" means today's leaked-but-encrypted evidence could be read once quantum computers arrive. That would expose sources years after they came forward. Dead Drop uses NIST post-quantum cryptography end to end:

| What | How |
|---|---|
| Encryption | QoreSeal v1: **ML-KEM-1024** (+ X25519 hybrid when the recipient publishes a signed card), AES-256-GCM |
| Recipient keys | ML-KEM-1024 key registered in QoreChain's on-chain KEM registry by a **hybrid ECDSA + ML-DSA-87** signed tx |
| Integrity | sha3-256 of each envelope anchored on chain; one flipped bit → refused |
| Source anonymity | the source has no wallet; a relayer submits, and the server sees only ciphertext and logs nothing |

## Features
- **`/submit` (source):** pick recipients, then choose a file (+ note). The file name and type are sealed too. Recipient cards are verified in the browser. You see the exact ciphertext the public chain will store, then relay it and download a **Proof of Silence** receipt.
- **Send to any wallet:** besides the curated recipients, add any `qor1…` / `0x…` address that has registered an inbox key, or open a share link `/submit?to=qor1…`. These show as *"key on chain · identity unverified"*; compare the key fingerprint with the recipient through another channel.
- **`/become` (any Qore wallet → recipient):** the phrase is used once, in the browser. If the wallet's ML-DSA-87 key is missing, the page registers it (with proof of possession), then registers the ML-KEM-1024 inbox key. Everything is signed on-device; the server only forwards the signed bytes and accepts nothing but these two message types.
- **`/inbox` (recipient), with no recovery phrase after the first time:** the phrase is entered once and the inbox keys are derived on-device. You can then lock **only the decryption keys** behind a **passkey** (fingerprint / Face ID / Windows Hello, via WebAuthn PRF) or a password. Stored keys can read drops but can't sign or move funds. Drops are hash-checked against the chain and decrypted locally, and there's a **Simulate tampering** button.
- **`/verify`:** check a Proof of Silence receipt against the chain.
- **Self-maintaining relayer:** QoreChain EVM authorisation windows last ~1 day. The relayer renews its own window (a hybrid-signed Cosmos tx) before it expires.
- Installable PWA.

## How it works
```
source browser                     relayer (Next.js API)              QoreChain
──────────────                     ─────────────────────              ─────────
fetch recipient ML-KEM keys ─────────────────────────────────────────► KEM registry
seal(file) → envelope  ──────────► recompute sha3, submit() ─────────► DeadDrop.sol (event + hash)
                                                                           │
recipient browser ◄──────────────── read Submitted events ◄────────────────┘
  passkey → keys → sha3 check → open()
```

## Run it locally
```bash
cd web
npm install
# web/.env.local (gitignored):
#   RELAYER_PRIVATE_KEY=0x…     relayer EVM key
#   RELAYER_MNEMONIC="…"        lets the relayer renew its EVM window
npm run dev -- -p 3006
```
Open http://localhost:3006. Demo walk-through: **Submit** a file → **Inbox** (phrase once → save passkey → lock → unlock with passkey) → **Decrypt** → **Simulate tampering** → **Verify** the receipt. To add your own wallet, go to **Receive** (`/become`), then paste its address on Submit.

## Repo layout
| Path | What |
|---|---|
| `contracts/` | Hardhat project, `DeadDrop.sol` (relayer-only `submit`, PQC-key-gated via the `pqcKeyStatus` precompile, `matches()` for receipts). `npx hardhat test` (9 tests) |
| `web/` | Next.js 15 app: pages `/submit` `/inbox` `/become` `/verify`; API `/api/relay` `/api/drops` `/api/recipients[/lookup]` `/api/verify` `/api/broadcast` `/api/chain/*` |
| `ops/` | Node scripts for testnet accounts, PQC/KEM registration, recipient cards, deploy, e2e. Secrets only in gitignored `ops/.env` |
| `docs/PLAN.md` | design notes · `HISTORY.md` decisions, tx hashes, gotchas |

## Built with
QoreSeal 0.1 · QoreSign · `@qorechain/sdk` · viem · Next.js 15 · Tailwind. QoreSeal 0.1.0 is pending external review. **This is a testnet demo; don't use it for real sources.**

## License
MIT
