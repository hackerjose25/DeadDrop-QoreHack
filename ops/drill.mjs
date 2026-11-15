// Q-Day Drill (18 Nov 2026) helper for the dedicated, fresh DRILL account (never held mainnet funds).
//   node drill.mjs deploy   — deploy a DeadDrop instance owned by DRILL with DRILL as relayer (needs a live unscoped window;
//                             open a tiny one first, and CLOSE it afterwards so no EVM window is left for the attacker)
//   node drill.mjs tx       — the "normal transaction" required during the drill: a hybrid-signed (ECDSA + ML-DSA-87) self-send
//   node drill.mjs status   — PQC key + EVM window + balance
// Threat model: the attacker holds DRILL's ECDSA key. Native txs need the ML-DSA-87 hybrid extension (classical-only → code 20);
// EVM txs need an authorisation window, and opening one needs the hybrid signature too; with no window open, nothing goes through.
import fs from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAccount, send, pqcStatus, windowStatus, getJson } from "./lib.mjs";

const acc = await loadAccount("drill");
const cmd = process.argv[2] || "status";
const qore = defineChain({ id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } } });
const out = new URL("./drill.json", import.meta.url);

if (cmd === "deploy") {
  const art = JSON.parse(fs.readFileSync(new URL("../contracts/artifacts/contracts/DeadDrop.sol/DeadDrop.json", import.meta.url)));
  const pub = createPublicClient({ chain: qore, transport: http() });
  const wallet = createWalletClient({ account: privateKeyToAccount(acc.privateKey), chain: qore, transport: http() });
  const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args: [acc.evm, "0x0000000000000000000000000000000000000a02"] });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`deploy reverted: ${hash}`);
  fs.writeFileSync(out, JSON.stringify({ account: { cosmos: acc.cosmos, evm: acc.evm }, deadDrop: r.contractAddress, deployTx: hash, block: Number(r.blockNumber), date: new Date().toISOString() }, null, 2));
  console.log(`drill DeadDrop at ${r.contractAddress} (tx ${hash})`);
} else if (cmd === "tx") {
  const m = { typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: { fromAddress: acc.cosmos, toAddress: acc.cosmos, amount: [{ denom: "uqor", amount: "1" }] } };
  const r = await send(acc, [m], 300000, "hybrid");
  console.log(`normal hybrid tx OK — submit this hash: ${r.transactionHash}`);
} else {
  const [p, w, b] = await Promise.all([pqcStatus(acc.cosmos), windowStatus(acc.cosmos), getJson(`/cosmos/bank/v1beta1/balances/${acc.cosmos}`)]);
  console.log(`drill ${acc.cosmos} / ${acc.evm}`);
  console.log(`  PQC: ${p?.account?.algorithm_name ?? "none"} key_type=${p?.account?.key_type ?? "-"} possession=${p?.account?.possession_proven ?? "-"}`);
  console.log(`  EVM window live: ${!!w?.live}${w?.live ? ` (${w.remaining_blocks} blocks left — CLOSE it before the drill)` : ""}`);
  console.log(`  balance: ${(Number(b.body.balances?.find((x) => x.denom === "uqor")?.amount ?? 0) / 1e6).toFixed(3)} QOR`);
}
