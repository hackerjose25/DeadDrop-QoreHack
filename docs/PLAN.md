# Dead Drop — Plan

## Architecture

```text
Source (browser, no account)                     Journalist (phone, mobile web)
  pick file ─┐                                     ┌─ keys from recovery phrase (sealSeedFromMnemonic), local only
             ▼                                     ▼
  fetch journalist's recipient card + on-chain   fetch envelope ─▶ sha3 == on-chain hash? ─▶ open() ─▶ document
  ML-KEM key ─▶ verifyRecipientCard ─▶ seal()                      ✗ tampered → refuse
             │   (ML-KEM-1024 + X25519, AES-256-GCM, in browser)
             ▼
  envelope ──▶ relayer API (no IP logs) ──▶ DeadDrop.sol on QoreChain EVM
                  relayer account: own ML-DSA key,      Submitted(id, recipients, sha3, size, uri | ciphertext)
                  EVM window scoped to DeadDrop.sol      block + timestamp = inclusion proof
             ▼
  Proof of Silence receipt (id, sha3, key fingerprint, tx, block) — verifiable by anyone, reveals nothing
```

## What goes where
| Data | Where |
|---|---|
| Journalist ML-KEM key | x/pqc KEM registry (native) |
| Journalist X25519 key + binding | Signed recipient card (QoreSign), served from the app |
| Envelope (small) | Inline in the `Submitted` event — judges see the ciphertext on-chain |
| Envelope (large) | Blob storage; SHA3-256 + size + pointer on-chain |
| Plaintext, journalist secret keys | Never leave the device |

## MVP (must work in the demo)
1. `ops/`: journalist + editor + relayer accounts, ML-DSA keys, KEM keys, signed recipient cards.
2. `DeadDrop.sol` + tests; deploy; relayer window scoped to it.
3. Web `/submit`: browser encryption, multi-recipient (journalist + editor), relayer submit, receipt download.
4. Web `/inbox`: recovery phrase → keys, list submissions, integrity check, decrypt, tamper demo.
5. Web `/verify`: paste a receipt, check against chain.
6. README with honest limits, AI_USAGE.md, cover, video.

## Later
Key rotation history, verified-source mode, large files via DA, native app, more recipient roles.

## Honest limits (README)
QoreSeal 0.1.0 not externally reviewed · timing/sizes/recipients are public · timestamp = inclusion time, not
creation time · encryption ≠ authenticity or truth · anonymity depends on the relayer and the source's network.
