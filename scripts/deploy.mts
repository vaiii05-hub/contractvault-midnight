// scripts/deploy.ts
// Deploys the compiled agreement contract (contract/build) to the Midnight
// Preview network from a Node.js headless wallet (wallet-sdk-* stack).
//
// Pattern follows the official example-bboard deploy harness and the proven
// eightblock.dev deploy script, adapted for this project's stateless contract
// (no private state, single `mySecretKey` witness).
//
// Usage:
//   docker run -d --name proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server
//   CONTRACTVAULT_SECRET=<64-hex> npx tsx scripts/deploy.mts
//
// Env vars (all optional):
//   MNEMONIC                24-word mnemonic; if absent a random seed is generated & printed.
//   CONTRACTVAULT_SECRET    64-hex secret used by the `mySecretKey` witness. If absent a random
//                           one is generated & printed. NOTE: to be recognized as partyA by the
//                           browser DApp, this MUST equal the browser's localStorage value
//                           (contractvault_secret_key) — i.e. copy it there before deploying.
//   PROOF_SERVER_URL        default http://127.0.0.1:6300
//   NETWORK                 default preview (only 'preview' is wired; swap the CONFIG block for
//                           preprod/other networks if ever needed).

import * as fs from "node:fs";
import * as path from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocket } from "ws";
import * as Rx from "rxjs";
import { Buffer } from "buffer";

import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { getNetworkId, setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles, generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { InMemoryTransactionHistoryStorage, TransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-abstractions";
import { CompiledContract } from "@midnight-ntwrk/compact-js";

// The wallet SDK syncs over WebSocket; expose `ws` as the global implementation.
(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;

setNetworkId("preprod");

const CONFIG = {
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  proofServer: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  faucet: "https://faucet.preprod.midnight.network/",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, "..", "contract", "build");

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") throw new Error("Invalid seed");
  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
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
    // Remote networks use a small fee overhead; the huge value is only for local undeployed nodes.
    costParameters: { additionalFeeOverhead: BigInt(1000), feeBlocksMargin: 5 },
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) => DustWallet(config).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, seed };
}

async function createProviders(
  walletCtx: ReturnType<typeof createWallet> extends Promise<infer T> ? T : never,
) {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signedRecipe = await walletCtx.wallet.signRecipe(
        recipe,
        (payload) => walletCtx.unshieldedKeystore.signData(payload),
      );
      return walletCtx.wallet.finalizeRecipe(signedRecipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStoragePasswordProvider: () => `Aa1!${walletCtx.seed}`,
      accountId: walletCtx.unshieldedKeystore.getBech32Address().toString(),
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function waitForDust(walletCtx: ReturnType<typeof createWallet> extends Promise<infer T> ? T : never) {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );

  if (state.dust.balance(new Date()) > BigInt(0)) {
    console.log("  DUST already available.");
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (nightUtxos.length > 0) {
    console.log("  Registering NIGHT UTXOs for DUST generation...");
    const dustState = await walletCtx.wallet.dust.waitForSyncedState();
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
      dustState.address,
    );
    const txId = await walletCtx.wallet.submitTransaction(await walletCtx.wallet.finalizeRecipe(recipe));
    console.log(`  DUST registration tx submitted: ${txId}`);
  }

  console.log(`  Waiting for DUST to be minted (can take a few minutes)...`);
  await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => s.dust.balance(new Date()) > BigInt(0)),
    ),
  );
  console.log("  DUST tokens ready!");
}

async function main() {
  // The compiled contract module (ESM) generated by the Compact compiler is
  // imported dynamically here (it requires `await`), which only works inside an
  // async function under CommonJS output from esbuild/tsx.
  //
  // IMPORTANT: the compiler emits `contract/build/contract/index.js`, but this
  // project's package.json has no `"type": "module"`, so tsx treats that `.js`
  // file as CommonJS and re-bundles its `@midnight-ntwrk/compact-runtime`
  // import into a *separate* module graph. That creates a second copy of the
  // onchain-runtime wasm classes, so when the contract constructor runs, the
  // `ContractState.set maintenanceAuthority` setter rejects the
  // `ContractMaintenanceAuthority` built by compact-js with
  // "expected instance of ContractMaintenanceAuthority".
  //
  // Loading an `.mjs` entry makes tsx leave the contract as ESM, so its
  // `@midnight-ntwrk/compact-runtime` import resolves through Node's shared
  // module cache — a single set of runtime classes shared with the rest of the
  // stack. We mirror `index.js` to `index.mjs` on every run so the loaded
  // entry always matches the latest compile output.
  const contractDir = path.join(zkConfigPath, "contract");
  const contractEntry = path.join(contractDir, "index.js");
  if (!fs.existsSync(contractEntry)) {
    throw new Error(`Contract not compiled: missing ${contractEntry}`);
  }
  const contractEntryMjs = path.join(contractDir, "index.mjs");
  fs.copyFileSync(contractEntry, contractEntryMjs);
  const contractModule = await import(pathToFileURL(contractEntryMjs).href);
  const Agreement = contractModule as typeof import("../contract/build/contract/index.js");

  // The `mySecretKey` witness drives partyA = publicKey(secret) on-chain.
  // For the browser DApp to recognize the deployed contracts as "mine" it must
  // use the same secret, so prefer the env var and fail loudly if it's missing.
  const secretHex = process.env.CONTRACTVAULT_SECRET;
  if (!secretHex || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error(
      "CONTRACTVAULT_SECRET must be set to the 64-hex secret your browser DApp uses " +
        "(see localStorage 'contractvault_secret_key'). Set it to a fresh value and copy " +
        "it into the browser if you haven't deployed the DApp yet.",
    );
  }
  const contractVaultSecret = Buffer.from(secretHex, "hex");

  // Note: both combinators are Effect `dual` functions. Chaining via `.pipe()`
  // does NOT work here — `withWitnesses`/`withCompiledFileAssets` spread the
  // input into a plain object, dropping the prototype that carries `pipe()`.
  type C = InstanceType<typeof Agreement.Contract>;
  const compiledContract = CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses<C, any, any>(
      CompiledContract.make("agreement", Agreement.Contract),
      {
        // Context is ignored: contract is stateless (PS = undefined).
        mySecretKey: () => [undefined, contractVaultSecret] as [undefined, Uint8Array],
      },
    ),
    zkConfigPath,
  );

    console.log("─── Deploying agreement contract to Midnight Preprod ───\n");

  const mnemonic = process.env.MNEMONIC;
  const seed = mnemonic
    ? toHex(Buffer.from(mnemonicToSeed(mnemonic)))
    : toHex(Buffer.from(generateRandomSeed()));
  if (!process.env.MNEMONIC) {
    console.log(`  ⚠️  Generated fresh wallet seed (SAVE THIS):\n  ${seed}\n`);
  }

  const walletCtx = await createWallet(seed);

  console.log("  Starting wallet sync...");
  await walletCtx.wallet.start(walletCtx.shieldedSecretKeys, walletCtx.dustSecretKey);

  console.log("  Syncing with network (first run can take a few minutes)...");
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced)),
  );
  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? BigInt(0);

  console.log(`\n  Wallet address: ${address}`);
  console.log(`  tNIGHT balance: ${balance.toString()}`);

  if (balance === BigInt(0)) {
    console.log("\n─── Fund your wallet ───");
    console.log(`  Visit ${CONFIG.faucet}`);
    console.log(`  Address: ${address}\n`);
    console.log("  Waiting for funds...");
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(10_000),
        Rx.filter((s) => s.isSynced),
        Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? BigInt(0)),
        Rx.filter((b) => b > BigInt(0)),
      ),
    );
    console.log("  Funds received!");
  }

  console.log("\n─── DUST setup ───");
  await waitForDust(walletCtx);

  console.log("\n─── Deploying contract ───");
  const providers = await createProviders(walletCtx);

  console.log("  This proves the constructor circuit and submits the deploy tx; 30-60s+ typical...");
  const deployed = await (deployContract as any)(providers, { compiledContract });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✅ Contract deployed!`);
  console.log(`  Contract address: ${contractAddress}`);
    console.log(`  Explorer: https://preprod.midnightexplorer.com/contract/${contractAddress}`);
  console.log(`  partyA secret: ${secretHex}`);

  fs.writeFileSync(
    path.resolve(__dirname, "..", "deployment.json"),
    JSON.stringify(
      {
        contractAddress,
        network: "preprod",
        seed,
        contractVaultSecret: secretHex,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log("\n  Saved deployment.json");

  await walletCtx.wallet.stop();
  console.log("\n─── Done ───");
}

function mnemonicToSeed(mnemonic: string): Uint8Array {
  // HDWallet accepts a 64-hex seed directly; for a mnemonic phrase we keep it
  // simple: derive a deterministic 32-byte seed from it (HMAC-SHA256 of "mnemonic").
  return new Uint8Array(createHmac("sha256", "mnemonic").update(mnemonic).digest());
}

main().catch((err) => {
  console.error("\nDeploy failed:", err);
  process.exit(1);
});
