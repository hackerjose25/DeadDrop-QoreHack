# Dead Drop — Project History

Running log of decisions, progress and verified facts. Update after every work session. Repo: github.com/hackerjose25/DeadDrop-QoreHack. Sister project: Leashed
(`../QuoreHack`, github.com/hackerjose25/QuoreHack). Leashed's HISTORY.md holds the QoreChain facts both projects share.

## Key dates (UTC, 2026)
- **2 Dec 23:59 — Submission deadline** (same hackathon: Build Before Q-Day, QoreChain Developer Fest 2026)
- 18 Nov — Q-Day Drill (Leashed's drill account; Dead Drop not registered)

## Pitch
**Expose the truth without exposing the source.** A post-quantum whistleblower drop: evidence is encrypted in the
source's browser to a journalist's on-chain ML-KEM-1024 key, anchored on QoreChain, and only the journalist can open
it — even after Q-Day ("harvest now, decrypt later" defeated). Signature feature: the **Proof of Silence** receipt.

## Decisions
| Date | Decision | Why |
|---|---|---|
| 15 Nov | Second project = Dead Drop (Codex proposal, refined) | Distinct from Leashed; strongest pure-PQC story; uses kits Leashed doesn't |
| 15 Nov | Name **Dead Drop**, not "QoreDrop" | "Qore-" reads as an official QoreChain kit; "drop" + crypto reads as airdrop |
| 15 Nov | Separate folder `Desktop/DeadDrop` and separate repo | Each project needs its own repo + project page |
| 15 Nov | Target category: Encrypted Apps if it exists, else Post-Quantum dApp | **Confirm on the Rules page** (not in our notes) |
| 15 Nov | Mobile-first **web** inbox, not a native app | Native QoreSeal (Swift/Kotlin) exists but too slow to build in ~2 weeks |
| 15 Nov | Submissions go through a **relayer** account | A source broadcasting from their own wallet would expose their address |

## Verified facts (15 Nov)
- npm: `@qorechain/qoreseal` 0.1.0 (29 Oct 2026), `@qorechain/qoresign` 0.2.0 (11 Nov), `@qorechain/pqc` 0.2.3. (Leashed's 13 Nov note "QoreSeal not on npm" is outdated.)
- QoreSeal: hybrid ML-KEM-1024 + X25519 (default) or ML-KEM-only; multi-recipient envelopes (`MAX_RECIPIENTS`);
  `seal`/`open`, `envelopeToText`/`envelopeFromText`, `sealSeedFromMnemonic`/`deriveSealKeys`;
  recipient cards signed with QoreSign (`signRecipientCard`, `verifyRecipientCard` against on-chain keys);
  `/network`: `fetchKemKey`, `resolveRecipient`, `sealToAddresses`.
- QoreSeal README limits: only the payload is confidential (addresses, timing, sizes public); envelopes are **not
  signed**; losing the seed loses the data; construction **pending external review before 1.0**.
- KEM key registry live on testnet (Leashed's owner registered one: tx A613157D…3309).

## Accounts (public only — keys in gitignored ops/.env)
| Role | qor1 | 0x | ML-DSA-87 | ML-KEM-1024 + card |
|---|---|---|---|---|
| Journalist (demo) | qor1v3xmt9craxzrkwspjfhkcfj9400j79drsxm2l4 | 0x644dB59703E9843b3A01926f6c2645abDF2F15a3 | ✅ tx 299636B1…13A7 | ✅ fp 8b5cabbba653a1d4…, card `ops/cards/journalist.json` |
| Editor (demo, 2nd recipient) | qor1h9zk5d5sk07p3dujzx3zcej7d5qskcqv957t5l | 0xb9456A3690B3fC18B79211A22C665e6D010B600C | ✅ tx 42DA75E9…D3B6 | ✅ fp 4085e8cc0f905dc8…, card `ops/cards/editor.json` |
| Relayer (submits for anonymous sources) | qor15twnl6d0f2uqpukq4mkkzt9lj69g3hjv6w2fll | 0xA2DD3FE9AF4ab800f2c0AeeD612CBf968a88DE4c | ✅ tx 466ADE2A…BE93 | — |
Funded from the QoreX wallet (Leashed's): 2 / 2 / 3 QOR.

## Deployed (testnet)
| Contract | Address | Tx | Notes |
|---|---|---|---|
| DeadDrop | 0xae3fac004379519392da56bfd7421ef93246e389 | 0xe17d110794cacc0830b5b426af3d0d40f94f68d47b852122cec51eb4ea40c533 | owner = journalist (newsroom), relayer = relayer account, pqcKeyStatus 0x…0a02 as immutable ctor arg |

Windows: journalist deploy window 600 blocks (closed F4333B25…86A7). Relayer window **scoped to DeadDrop only**, 100 txs, 2 QOR.

**Gotcha (15 Nov):** EVM windows are capped at **17,280 blocks (~1 day)**. When the relayer window expires, every relay fails with viem's generic "Missing or invalid parameters." (the real reason, "EVM authorisation window exhausted", is in `err.details`; `/api/relay` now surfaces it). Fix: `cd ops && node window.mjs relayer open --blocks 17280 --txs 500 --qor 10 --targets 0xae3fac004379519392da56bfd7421ef93246e389`. Reopened 15 Nov ~block 10132680 → expires ~16 Nov. **Reopen before any demo / judging.**

First on-chain drop (15 Nov): id 0xcf69bfaa…75e1, envelope 3448 B inline, sha3 0x3c9a9a48…2ec9, tx 0x086395238fd7f17f934797119c7966b780e329b00871df2bd10ec1796ff928f5 (block 10114973). Journalist read the Submitted event, matches() = true, decrypted the original text.

## Kits map (from build.qorechain.io/kits, 15 Nov)
Official kit list (versions refresh hourly there). Relevant to Dead Drop:
- **Handles** `@qorechain/handles` 0.1.0 — QoreX @handle → address, signature checked against a pinned registry key → "drop to @journalist" + anti-impersonation.
- **SDK React** `@qorechain/react` 0.14.0 (+ `@qorechain/sdk`) — web app chain reads.
- **QoreX integrations** 0.1.0 — `@qorechain/qorex-cosmos-kit` / `-interchain-kit` / `-rainbowkit`, `-wallet-mock` (e2e tests), `-synpress`.
- **QoreSign** 0.2.0 — Sign In With QoreChain for the journalist inbox.
- **RDK** `@qorechain/rdk` 0.9.0 — data-availability blobs for large envelopes.
- **QoreScan** 0.1.0 — `npx @qorechain/qorescan scan --network testnet --out cbom.json` (CycloneDX CBOM; "inventory aid, not a certification").
- Others: create-qorechain-dapp 0.14.0 (full-stack starter), Wallet adapter 0.6.0 (Keplr/Leap + ML-DSA hybrid), MCP + qore CLI 0.1.0 (read-only), Asset Kit, Custody kit, Chain bridge, PQ light client (can't verify live net yet).
- Faucet: https://dashboard.qorechain.io/faucet (QOR + fUSD/fETH/fBTC). Docs: https://docs.qorechain.io.

## Web app (15 Nov)
Next.js 15 in `web/` (port 3006 locally). Dark "evidence room" theme, amber accent, installable PWA (manifest, start_url /inbox).
- `/submit` — loads recipients + their on-chain ML-DSA-87/ML-KEM keys, **verifies each signed card in the browser**, packs file (+name/type/note, sealed too), `seal()` in browser to all chosen recipients, shows the ciphertext ("what the public chain will see"), POST to relayer, downloads the Proof of Silence receipt.
- `/inbox` — recovery phrase → `deriveSealKeys` on device (words cleared right after), identifies the recipient by matching its ML-KEM key against chain, lists drops from `Submitted` events, sha3 check vs anchored hash, decrypts locally, text/image preview, save file, **Simulate tampering** (1 bit → refused).
- `/verify` — paste/load a receipt → `matches()` + stored submission.
- API: `/api/recipients`, `/api/relay` (recomputes sha3 server-side, logs nothing), `/api/drops?recipient=`, `/api/verify`. REST fetches retried (testnet drops requests).
- Relayer key in gitignored `web/.env.local` (derived from ops/.env RELAYER_MNEMONIC).
- **Headless-Chrome UI e2e ✅** (scratchpad `dd-ui-test.mjs`): cards verified → seal → relay (tx 0x74df2158…4e2042) → inbox unlock → decrypt → tamper refused. (Test-harness gotcha: set React-controlled inputs only after hydration, or clear then set.)
- Handles: registry baseUrl + pubkey NOT published (docs: built into QoreX/dashboard; ask QoreChain). Parked; using address + signed card meanwhile.
- Funding 15 Nov: user claimed faucet (QoreX 104 QOR) → relayer +15, journalist +5.

## Live (15 Nov)
- **https://dead-drop-eta.vercel.app** (Vercel, root dir `web`, env RELAYER_PRIVATE_KEY). First deploy failed: Vercel blocks vulnerable Next 15.1.6 → upgraded to 15.5.29.
- User's first live drop: 35.4 KB PNG ("kitten_optimized_20.png") → 39,742 B envelope, EVM tx 0x3d17e925…2c6fa6 = Cosmos tx 6ECF6189…499F.
- **Explorer gotcha:** explore.qore.network/tx/ wants the **Cosmos tx hash** (hex, no 0x); EVM hashes give "encoding/hex: invalid byte 'x'". Map via REST `/cosmos/tx/v1beta1/txs?query=ethereum_tx.ethereumTxHash='0x…'`. App now returns `cosmosTx` and links with it (fallback: block page). **Leashed's README/dashboard EVM-hash explorer links have the same bug.**
- **RPC gotcha:** eth_getLogs max 10,000 blocks per query → `dropsFor` pages in 9,000-block chunks. **Leashed's getHistory has the same latent bug.**

## Open questions
- Does the hackathon allow one team to submit two projects? Is "Encrypted Apps" a real category?
- Large files: inline-in-event limit on QoreChain EVM (tx size / gas); else blob storage + on-chain hash.

## Progress log
### 15 Nov
- Folder + git (`main`), LICENSE (MIT), .gitignore. `ops/` with qoreseal, qoresign, pqc, sdk, viem installed.
- Read QoreSeal 0.1.0 API (above). Wrote `docs/PLAN.md`.
- Ops copied from Leashed (roles journalist/editor/relayer). Created + funded + ML-DSA-registered all three.
- `setup-recipient.mjs`: QoreSeal-standard keys (`deriveSealKeys` from mnemonic), KEM key registered (SDK `msg.pqc.registerKemKey`; QoreSeal's `buildRegisterKemKeyMessage` output didn't fit our signer → "empty address"), recipient card signed with QoreSign (classical key needs raw bytes, not hex string), verified via `resolveRecipient`.
- `e2e-seal.mjs` ✅: sealToAddresses(journalist+editor) → both open; outsider NOT_A_RECIPIENT; 1-byte tamper DECRYPTION_FAILED. Envelope overhead ≈3.4 KB for 2 recipients (63 B plaintext → 3447 B) — matters for inline-on-chain size.
- `contracts/`: Hardhat (config from Leashed). `DeadDrop.sol`: relayer-only `submit` (PQC-key-gated via precompile), inline envelope ≤48 KB or hash+uri, `acknowledge` by recipients, `matches()` = Proof of Silence check, `setRelayer` PQC-gated. **9/9 tests** (mock precompile).
- Deployed (`ops/deploy.mjs`), relayer window scoped to it, full on-chain round trip `ops/e2e-chain.mjs` ✅ (see Deployed).
### 15 Nov (later)
- Relay auto-renews the relayer EVM window (`web/src/lib/window.ts`): checks `/qorechain/pqc/v1/evm_window` before each send, reopens (17,280 blocks, 500 txs, 10 QOR, DeadDrop-only) when low, retries once on "authorisation window" rejection. Needs `RELAYER_MNEMONIC` server-side (**add to Vercel env**). Build ✅; renewal path not yet exercised live (window was still open, ~11.5k blocks left).
- Inbox vault (`web/src/lib/vault.ts`): recovery phrase only at first setup; then only the derived QoreSeal keys are kept in localStorage, AES-256-GCM under a **passkey (WebAuthn PRF → HKDF)** or a password (PBKDF2 600k). Stored keys can read drops but not sign/spend. Inbox: "Welcome back" unlock, Lock, "Forget this device", "Use recovery phrase instead". Password round-trip + wrong-password tested in Node; passkey needs a real browser (PRF: Chrome/Edge + Windows Hello/Android/iCloud Keychain; falls back to password if PRF missing).
- **Become a recipient (`/become`)** — any verified Qore wallet (ML-DSA-87 key registered) can receive drops. Browser derives seal keys from the phrase, hybrid-signs `MsgRegisterKEMKey` on-device; `/api/broadcast` only forwards signed bytes (testnet RPC + REST have **no CORS**) and refuses anything but KEM registrations; `/api/chain/*` = read-only REST proxy (auth/bank/qorechain/tendermint only). Shares `/submit?to=<qor1>`.
- Card-less recipients: the KEM key on chain is already bound to the address by the hybrid-signed registration tx, so senders seal in QoreSeal **`mode: "mlkem"`** (pure ML-KEM-1024) when any recipient has no card; curated ones with cards keep hybrid. UI badge "key on chain · identity unverified" (compare fingerprint out-of-band).
- `resolveRecipient` (server): curated id or any qor1/0x with a KEM key → relay, drops, lookup all accept it. Inbox finds non-curated recipients by deriving the address from the phrase (vault stores recipientId).
- Test account **outsider** `qor1hne560tp5a6aw8rhl88vuej74fcjnw6wjv88x6` (ops/.env OUTSIDER_MNEMONIC; 2 QOR; ML-DSA tx 9C5734…C966; KEM tx 2AD448…BD41). E2E ✅: register → lookup by 0x → seal to outsider+journalist → relay (cosmos 4E25A1…D43A) → outsider inbox decrypts, journalist too; bank-send refused by broadcast guard; proxy 403s other modules. Headless Chrome ✅: /become in browser, `?to=` preselect, inbox phrase unlock → **passkey save (virtual authenticator + PRF) → lock → passkey unlock**, vault has no phrase.
- Gotcha: a stale `next start` from an old session can hold port 3006 → EADDRINUSE / old code answering.
- `/become` now also registers the wallet's **ML-DSA-87 key** when missing (MsgRegisterPQCKeyV2 + proof of possession, classical-signed bootstrap, 700k gas ≈ 0.11 QOR), then the KEM key. Broadcast guard allows only those two msg types. Tested in headless Chrome with brand-new wallet **fresh** `qor1qgrdp3xr76fcwnf43v8q3jghrxltae57gx8mxf` (1 QOR): ML-DSA tx 0F92F635…18394B, KEM tx 887CE37F…CB4C54. (Triggered by user's own wallet qor1shvuvy…a6fuvz having no PQC key.)
