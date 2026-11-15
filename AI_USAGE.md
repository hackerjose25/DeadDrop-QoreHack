# AI usage

Dead Drop was built by one human developer working with **Claude Code** (Anthropic's coding agent, Claude Opus models) inside VS Code. This file records honestly what the AI did, what the human did, and how we worked. Decisions, transaction hashes and gotchas are in [HISTORY.md](HISTORY.md), which the agent re-reads at the start of every session ([CLAUDE.md](CLAUDE.md) tells it to).

## Workflow
1. **Human sets direction.** The human chooses the idea (a post-quantum whistleblower drop), the target bounty, and what to build next. Many features started as the human's questions or complaints while testing, for example:
   - *"Why do we need the recovery phrase every time? It's very sensitive."* → the passkey vault.
   - *"Why can I only send to those 2 wallets?"* → "Become a recipient" and send-to-any-address.
   - A screenshot of `/become` failing on the human's own wallet → automatic ML-DSA-87 key registration.
2. **AI investigates before coding.** It read the QoreChain kit sources and type definitions (`@qorechain/qoreseal`, `qoresign`, `sdk`), probed the testnet (CORS headers, `eth_getLogs` limits, EVM window rules), and proposed options with trade-offs. The human picked one.
3. **AI implements and verifies on the real testnet.** It wrote the contract, ops scripts and web app, ran them against `qorechain-diana`, and wrote end-to-end tests: Node scripts plus headless Chrome with a virtual WebAuthn authenticator. Nothing was called done without a passing run on chain.
4. **Human tests and ships.** The human used the app in their own browser, claimed faucet funds, configured Vercel (env vars, deploys) and asked for each commit and push.
5. **Logging.** After each session the agent updates `HISTORY.md` and commits with a `Co-Authored-By: Claude` line, so the AI's share is visible in `git log`.

## What the AI generated
- `contracts/DeadDrop.sol` and its Hardhat tests (mock `pqcKeyStatus` precompile).
- `ops/` scripts: account creation, ML-DSA-87 and ML-KEM-1024 registration, recipient cards, deploy, EVM windows, e2e checks, and the Q-Day drill helper (`drill.mjs`).
- The `web/` Next.js app: sealing in the browser, the relayer, inbox, verify, the passkey/password key vault, `/become`, the API routes, and the relayer's self-renewing EVM window.
- Docs: README, HISTORY, this file.

## What the human did
- Concept, scope, bounty strategy and every product decision. Examples: passkey unlock instead of the phrase, opening recipients up to any wallet, what to demo.
- Manual testing in a real browser and reporting failures with screenshots.
- Wallets and funds (QoreX, faucet), Vercel setup, secrets handling and GitHub.
- Reviewing changes and approving commits and pushes.

## Guardrails we kept
- The AI never prints or commits mnemonics or private keys. Secrets stay in gitignored `ops/.env` and `web/.env.local`, and test scripts read them without echoing.
- The AI asks before acting on anything outward-facing or tied to the human's own funds wallet.
- Every testnet claim in the README or HISTORY comes with a transaction hash from an actual run.
