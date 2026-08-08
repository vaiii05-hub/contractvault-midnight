import { WebSocket } from "ws";
import * as Rx from "rxjs";
import { Buffer } from "buffer";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles, generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import { createKeystore, PublicKey, UnshieldedWallet } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { InMemoryTransactionHistoryStorage, TransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-abstractions";
import { getNetworkId, setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
setNetworkId("preview");

const CONFIG = {
  indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preview.midnight.network",
  proofServer: "http://127.0.0.1:6300",
};
const t0 = Date.now();
const log = (m: unknown) => console.log(`${Date.now() - t0}ms ${m}`);

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") throw new Error("Invalid seed");
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== "keysDerived") throw new Error("Key derivation failed");
  hdWallet.hdWallet.clear();
  return result.keys;
}

async function createWallet(seed: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  const walletConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
    relayURL: new URL(CONFIG.node.replace(/^http/, "ws")),
    provingServerUrl: new URL(CONFIG.proofServer),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(TransactionHistoryStorage.TransactionHistoryCommonSchema),
    costParameters: { additionalFeeOverhead: BigInt(1000), feeBlocksMargin: 5 },
  };
  log("WalletFacade.init...");
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) => DustWallet(config).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  log("WalletFacade.init done");
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, seed };
}

const seed = Buffer.from(generateRandomSeed()).toString("hex");
let done = false;
const sj = (o: unknown) => JSON.stringify(o, (_k, v) => typeof v === "bigint" ? v.toString() : v);
let lastApplied = "";

(async () => {
  const walletCtx = await createWallet(seed);
  walletCtx.wallet.state().subscribe({
    next: (s) => {
      if (done) return;
      const a = s?.shielded?.progress?.appliedIndex;
      const tag = a !== undefined ? String(a) : String(s?.isSynced ?? "?");
      if (tag !== lastApplied && a !== undefined) {
        lastApplied = tag;
        log(`appliedIndex=${a} hi=${s?.shielded?.progress?.highestRelevantWalletIndex}`);
      }
      if (s.isSynced && !done) {
        done = true;
        log(`>>> SYNCED: ${sj(s).slice(0, 300)}`);
        log(`>>> address=${walletCtx.unshieldedKeystore.getBech32Address().toString()}`);
        console.log("SYNCED_MARKER");
        walletCtx.wallet.stop().then(() => process.exit(0));
      }
    },
    error: (e) => log("state error: " + e?.message),
  });
  process.on("unhandledRejection", (e: unknown) => log("unhandledRejection: " + (e instanceof Error ? e.message : String(e))));
  await walletCtx.wallet.start(walletCtx.shieldedSecretKeys, walletCtx.dustSecretKey);
  let wallet = walletCtx.wallet;
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });

setTimeout(() => { log("TIMEOUT 240s"); process.exit(0); }, 240000);