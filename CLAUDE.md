# Dead Drop — notes for Claude

**Read `HISTORY.md` first** (decisions, accounts, deployed contract, tx hashes, gotchas, kit map), then `docs/PLAN.md`.

- Post-quantum whistleblower drop on QoreChain testnet (`qorechain-diana`, EVM chain 9800) for the Build Before Q-Day hackathon (deadline 2026-12-02 23:59 UTC).
- Repo: github.com/hackerjose25/DeadDrop-QoreHack · Live: https://dead-drop-eta.vercel.app (Vercel, root dir `web`).
- Sister project **Leashed** lives in `../QuoreHack` (github.com/hackerjose25/Leashed-QuoreHack). Never mix their accounts, contracts or repos.

## Layout
- `contracts/` Hardhat · `DeadDrop.sol` · `npx hardhat test` (9 tests, mock pqcKeyStatus precompile)
- `ops/` Node scripts (journalist / editor / relayer accounts, keys, cards, deploy, e2e). Secrets only in gitignored `ops/.env`.
- `web/` Next.js 15.5 app: `/submit` `/inbox` `/verify` + `/api/*`. Relayer key in gitignored `web/.env.local`.

## Rules
- Never print or commit mnemonics or private keys. Funding wallet = QoreX (`QOREX_MNEMONIC`), via `ops/qorex-send.mjs`.
- Claude runs ops scripts against testnet directly; the testnet REST/RPC occasionally drops a request — retry.
- Explorer `/tx/` links need the **Cosmos** tx hash (no 0x), not the EVM hash.
- `eth_getLogs` is capped at 10,000 blocks per query — page through ranges.
- Update `HISTORY.md` after every work session; commit with the co-author line.
