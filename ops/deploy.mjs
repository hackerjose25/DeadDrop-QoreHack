// node deploy.mjs — deploy DeadDrop from the JOURNALIST account (newsroom = owner); relayer = RELAYER account.
// Needs a live UNSCOPED journalist window (contract creation is refused through a scoped one). Saves deployments.json.
import fs from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAccount } from "./lib.mjs";

const qore = defineChain({
  id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [process.env.QORE_EVM_RPC || "https://evm-testnet.qore.host"] } },
});
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";

const owner = await loadAccount("journalist");
const relayer = await loadAccount("relayer");
const art = JSON.parse(fs.readFileSync(new URL("../contracts/artifacts/contracts/DeadDrop.sol/DeadDrop.json", import.meta.url)));
const pub = createPublicClient({ chain: qore, transport: http() });
const wallet = createWalletClient({ account: privateKeyToAccount(owner.privateKey), chain: qore, transport: http() });

console.log(`Deploying DeadDrop (owner ${owner.evm}, relayer ${relayer.evm}) ...`);
const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args: [relayer.evm, PQC_KEY_STATUS] });
console.log(`tx: ${hash}`);
const r = await pub.waitForTransactionReceipt({ hash });
if (r.status !== "success") throw new Error(`deploy reverted: ${hash}`);
const out = {
  network: "qorechain-diana (9800)",
  deadDrop: r.contractAddress,
  deployTx: hash,
  block: Number(r.blockNumber),
  owner: { evm: owner.evm, cosmos: owner.cosmos, role: "journalist / newsroom" },
  relayer: { evm: relayer.evm, cosmos: relayer.cosmos },
  pqcKeyStatus: PQC_KEY_STATUS,
  date: new Date().toISOString(),
};
fs.writeFileSync(new URL("./deployments.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`DeadDrop deployed at ${r.contractAddress}`);
