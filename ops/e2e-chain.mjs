// node e2e-chain.mjs ["message"] — full on-chain round trip:
// source seals → relayer submits to DeadDrop (inline envelope) → journalist reads the event → SHA3 check via matches()
// → decrypts. Prints the Proof of Silence receipt.
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, http, defineChain, parseEventLogs, toHex, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deriveSealKeys, open } from "@qorechain/qoreseal";
import { sealToAddresses } from "@qorechain/qoreseal/network";
import { loadAccount, NET } from "./lib.mjs";

const qore = defineChain({ id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [process.env.QORE_EVM_RPC || "https://evm-testnet.qore.host"] } } });
const PURPOSE = "deaddrop/v1";
const dep = JSON.parse(fs.readFileSync(new URL("./deployments.json", import.meta.url)));
const abi = JSON.parse(fs.readFileSync(new URL("../contracts/artifacts/contracts/DeadDrop.sol/DeadDrop.json", import.meta.url))).abi;
const card = (r) => JSON.parse(fs.readFileSync(new URL(`./cards/${r}.json`, import.meta.url)));
const pub = createPublicClient({ chain: qore, transport: http() });

const [j, e, relayer] = await Promise.all(["journalist", "editor", "relayer"].map(loadAccount));

// 1) Source (no account): seal in "the browser"
const plaintext = new TextEncoder().encode(process.argv[2] || `Dead Drop e2e ${new Date().toISOString()}: the memo is in drawer 3.`);
const envelope = await sealToAddresses({ rest: NET.rest, chainId: NET.chainId, purpose: PURPOSE, plaintext,
  recipients: [{ address: j.cosmos, card: card("journalist") }, { address: e.cosmos, card: card("editor") }] });
const envSha3 = "0x" + createHash("sha3-256").update(envelope).digest("hex");
const id = toHex(randomBytes(32));
console.log(`sealed ${plaintext.length} B → ${envelope.length} B envelope, sha3 ${envSha3.slice(0, 18)}…`);

// 2) Relayer submits (source's address never touches the chain)
const wallet = createWalletClient({ account: privateKeyToAccount(relayer.privateKey), chain: qore, transport: http() });
const { request } = await pub.simulateContract({ address: dep.deadDrop, abi, functionName: "submit", account: wallet.account,
  args: [id, [j.evm, e.evm], envSha3, envelope.length, "", toHex(envelope)] });
const hash = await wallet.writeContract(request);
const r = await pub.waitForTransactionReceipt({ hash });
if (r.status !== "success") throw new Error("submit reverted");
console.log(`relayer submitted  tx ${hash}  block ${r.blockNumber}`);

// 3) Journalist: read the event back from chain, check integrity, decrypt
const [ev] = await pub.getContractEvents({ address: dep.deadDrop, abi, eventName: "Submitted", args: { id }, fromBlock: r.blockNumber, toBlock: r.blockNumber });
const fromChain = hexToBytes(ev.args.envelope);
const gotSha3 = "0x" + createHash("sha3-256").update(fromChain).digest("hex");
const ok = await pub.readContract({ address: dep.deadDrop, abi, functionName: "matches", args: [id, gotSha3] });
console.log(`journalist fetched ${fromChain.length} B from the Submitted event · matches() = ${ok}`);
const opened = open({ chainId: NET.chainId, purpose: PURPOSE, envelope: fromChain, keys: deriveSealKeys({ mnemonic: process.env.JOURNALIST_MNEMONIC.trim() }) });
console.log(`journalist decrypted: "${new TextDecoder().decode(opened)}"`);

// 4) Proof of Silence receipt
const block = await pub.getBlock({ blockNumber: r.blockNumber });
console.log("\nProof of Silence receipt:", JSON.stringify({
  submissionId: id, envelopeSha3: envSha3, size: envelope.length, recipients: [j.cosmos, e.cosmos],
  contract: dep.deadDrop, tx: hash, block: Number(r.blockNumber), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
  scheme: "QoreSeal v1 · ML-KEM-1024 + X25519 · AES-256-GCM", chainId: NET.chainId,
}, null, 2));
