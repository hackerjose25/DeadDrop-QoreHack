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

## Open questions
- Does the hackathon allow one team to submit two projects? Is "Encrypted Apps" a real category?
- Large files: inline-in-event limit on QoreChain EVM (tx size / gas); else blob storage + on-chain hash.

## Progress log
### 15 Nov
- Folder + git (`main`), LICENSE (MIT), .gitignore. `ops/` with qoreseal, qoresign, pqc, sdk, viem installed.
- Read QoreSeal 0.1.0 API (above). Wrote `docs/PLAN.md`.
