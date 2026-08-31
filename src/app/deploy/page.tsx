"use client";

import { useState } from "react";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { CostModel, Transaction } from "@midnight-ntwrk/ledger-v8";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { Contract } from "../../../contract/build/contract/index.js";
import {
  connectWallet,
  getConnectedAPI,
  getLocalSecretKeyBytes,
} from "../../lib/wallet";
import { bytesToHex, hexToBytes, dumpError } from "../../lib/contract";

export default function DeployPage() {
  const [status, setStatus] = useState<string>("Idle");
  const [log, setLog] = useState<string[]>([]);
  const [address, setAddress] = useState<string | null>(null);

  function appendLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function handleDeploy() {
    setStatus("Connecting wallet...");
    setLog([]);
    setAddress(null);

    try {
      const addr = await connectWallet();
      if (!addr) {
        setStatus("Wallet connection failed");
        return;
      }
      appendLog(`Connected: ${addr}`);

      const api = await getConnectedAPI();
      if (!api) {
        setStatus("No connected API");
        return;
      }

      setStatus("Building providers...");
      const config = await api.getConfiguration();
      setNetworkId(config.networkId);
      appendLog(`Network: ${config.networkId}`);

      const zkConfigProvider = new FetchZkConfigProvider(
        `${window.location.origin}/api/zk`,
        fetch.bind(window),
      );
      const publicDataProvider = indexerPublicDataProvider(
        config.indexerUri,
        config.indexerWsUri,
      );
      const provingProvider = httpClientProvingProvider(
        `${window.location.origin}/api/proof`,
        zkConfigProvider,
      );

      const proofProvider = {
        async proveTx(unprovenTx: any): Promise<any> {
          appendLog("Proving transaction (local proof server)...");
          const proven = await unprovenTx.prove(
            provingProvider,
            CostModel.initialCostModel(),
          );
          appendLog("Transaction proved.");
          return proven;
        },
      };

      const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
        await api.getShieldedAddresses();

      const walletProvider = {
        getCoinPublicKey: () => shieldedCoinPublicKey,
        getEncryptionPublicKey: () => shieldedEncryptionPublicKey,
        async balanceTx(tx: any): Promise<any> {
          const serialized = tx.serialize() as Uint8Array;
          appendLog(`Balancing transaction (${serialized.length} bytes)...`);
          // Re-fetch a fresh connected API right before this call: Lace's
          // background connection can go stale between steps (closing the
          // approval popup tears down the previous reference), causing
          // RemoteApiShutdownError on reuse.
          const freshApi = (await getConnectedAPI()) ?? api;
          const result = await freshApi.balanceUnsealedTransaction(
            bytesToHex(serialized),
          );
          const balanced = Transaction.deserialize(
            "signature",
            "proof",
            "binding",
            hexToBytes(result.tx),
          );
          appendLog("Transaction balanced.");
          return balanced;
        },
      };

           const midnightProvider = {
        async submitTx(tx: any): Promise<string> {
          const serialized = tx.serialize() as Uint8Array;
          const txId = tx.identifiers()[0];
          appendLog(`Submitting transaction ${txId}...`);
          const freshApi = (await getConnectedAPI()) ?? api;
          await freshApi.submitTransaction(bytesToHex(serialized));
          appendLog("Transaction submitted!");
          return txId;
        },
      };

      const privateStateProvider = {
        setContractAddress() {},
        async get() {
          return null;
        },
        async set() {},
        async remove() {},
        async clear() {},
        async getSigningKey() {
          return null;
        },
        async setSigningKey() {},
        async removeSigningKey() {},
        async clearSigningKeys() {},
        async exportPrivateStates(): Promise<never> {
          throw new Error("not supported");
        },
        async importPrivateStates(): Promise<never> {
          throw new Error("not supported");
        },
        async exportSigningKeys(): Promise<never> {
          throw new Error("not supported");
        },
        async importSigningKeys(): Promise<never> {
          throw new Error("not supported");
        },
      };

      const providers = {
        privateStateProvider,
        publicDataProvider,
        zkConfigProvider,
        proofProvider,
        walletProvider,
        midnightProvider,
      } as any;

      setStatus("Building compiled contract...");
      const secretKey = getLocalSecretKeyBytes();
      const compiledContract = CompiledContract.withWitnesses<any, any, any>(
        CompiledContract.make<any, any, any>("agreement", Contract as any),
        {
          mySecretKey: () => [undefined, secretKey] as [undefined, Uint8Array],
        },
      );

      setStatus("Deploying (this proves + submits, ~30-60s)...");
      const deployed = await (deployContract as any)(providers, {
        compiledContract,
      });

      const contractAddress = deployed.deployTxData.public.contractAddress;
      appendLog(`Deployed! Contract address: ${contractAddress}`);
      setAddress(contractAddress);
      setStatus("Success!");
    } catch (err: any) {
      dumpError("browser deploy failed", err);
      setStatus(`Failed: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1>Browser Deploy (Preprod, via Lace)</h1>
      <p>
        Deploys the compiled agreement contract using the already-connected
        Lace wallet for balancing/submission, and the local proof server for
        proving — bypassing the Node.js headless deploy script.
      </p>
      <button onClick={handleDeploy} style={{ padding: "10px 20px", fontSize: 16 }}>
        Deploy Contract
      </button>
      <p style={{ marginTop: 16, fontWeight: "bold" }}>Status: {status}</p>
      {address && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          Contract Address: {address}
        </p>
      )}
      <pre style={{ background: "#111", color: "#0f0", padding: 16, marginTop: 16, fontSize: 12, overflowX: "auto" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}