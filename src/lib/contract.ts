// src/lib/contract.ts
// Browser-side client for the deployed agreement contract.
//
// All transaction work is delegated to the 1AM wallet (the same wallet
// wallet.ts connects to): the wallet proves the ZK circuit, balances the
// transaction and sponsors dust fees, then submits it. ZK artifacts are served
// to the wallet by our /api/zk route, and public state comes from the indexer
// the wallet points us at. See https://1am.xyz/developers for the upstream
// pattern this follows.
//
// The midnight-js provider and compiled-contract generics are extremely
// heavy; the casts below mirror the deploy harness in scripts/deploy.mts.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { CostModel, Transaction } from "@midnight-ntwrk/ledger-v8";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { Contract } from "../../contract/build/contract/index.js";
import type { SigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { getConnectedAPI, getLocalSecretKeyBytes } from "./wallet";

// The deployed agreement contract on Midnight Preview. Mirrors the
// `contractAddress` saved in deployment.json by scripts/deploy.mts.
export const CONTRACT_ADDRESS =
  "bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439";

// ---------- Hex helpers ----------

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

// ---------- Private state provider (stateless contract) ----------
// The agreement contract has no private state, so this store is only used for
// the contract maintenance signing key. A tiny in-memory map is enough; the
// key is persisted to localStorage so it survives page reloads.

const SIGNING_KEY_STORAGE_KEY = "contractvault_contract_signing_keys";
let signingKeyCache = new Map<string, SigningKey>();

function loadSigningKeys(): Map<string, SigningKey> {
  if (typeof window === "undefined") return signingKeyCache;
  try {
    const raw = localStorage.getItem(SIGNING_KEY_STORAGE_KEY);
    if (raw) signingKeyCache = new Map(JSON.parse(raw));
  } catch {
    signingKeyCache = new Map();
  }
  return signingKeyCache;
}

function saveSigningKeys(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIGNING_KEY_STORAGE_KEY, JSON.stringify([...signingKeyCache.entries()]));
  } catch {
    // Non-fatal: the key just won't survive the next reload.
  }
}

function createPrivateStateProvider(): any {
  return {
    setContractAddress(address: string): void {
      // No per-contract private state for this contract.
      void address;
    },
    async get(): Promise<unknown> {
      return null;
    },
    async set(): Promise<void> {
      // Nothing to store for a stateless contract.
    },
    async remove(): Promise<void> {
      // Nothing to remove.
    },
    async clear(): Promise<void> {
      // Nothing to clear.
    },
    async getSigningKey(address: string): Promise<SigningKey | null> {
      return loadSigningKeys().get(address) ?? null;
    },
    async setSigningKey(address: string, signingKey: SigningKey): Promise<void> {
      loadSigningKeys().set(address, signingKey);
      saveSigningKeys();
    },
    async removeSigningKey(address: string): Promise<void> {
      loadSigningKeys().delete(address);
      saveSigningKeys();
    },
    async clearSigningKeys(): Promise<void> {
      signingKeyCache = new Map();
      saveSigningKeys();
    },
    async exportPrivateStates(): Promise<never> {
      throw new Error("Private state export is not supported for a stateless contract.");
    },
    async importPrivateStates(): Promise<never> {
      throw new Error("Private state import is not supported for a stateless contract.");
    },
    async exportSigningKeys(): Promise<never> {
      throw new Error("Signing key export is not supported.");
    },
    async importSigningKeys(): Promise<never> {
      throw new Error("Signing key import is not supported.");
    },
  };
}

// ---------- Error diagnostics ----------

// Midnight node ledger-validation codes (LedgerApiError), surfaced by the RPC
// layer as `InvalidTransaction::Custom(N)` inside the `1010` envelope. The
// data field of the rejected-submission error carries "Custom error: N".
// Source: https://docs.midnight.network/nodes/error-codes
const MIDNIGHT_ERROR_CODES: Record<number, string> = {
  100: "EffectsMismatch (declared tx effects don't match computed effects)",
  101: "ContractAlreadyDeployed",
  102: "ContractNotPresent",
  103: "Zswap (double-spend / unknown Merkle root)",
  104: "Transcript (on-chain transcript execution failed)",
  106: "VerifierKeyNotFound",
  108: "ReplayCounterMismatch",
  110: "VerifierKeyNotSet",
  111: "TransactionTooLarge",
  112: "VerifierKeyTooLarge",
  113: "VerifierKeyNotPresent",
  114: "ContractNotPresent",
  115: "InvalidProof (ZK proof verification failed — regenerate proof, check proof-server compatibility)",
  116: "BindingCommitmentOpeningInvalid",
  117: "NotNormalized",
  126: "Unbalanced",
  127: "Zswap (structurally malformed offer)",
  138: "BalanceCheckOverspend",
  154: "BlockLimitExceededError",
  166: "InvalidNetworkId (tx built for a different network than the node)",
  168: "FeeCalculation",
  169: "InvalidDustRegistrationSignature",
  170: "InvalidDustSpendProof",
  171: "OutOfDustValidityWindow (DUST outside its validity window)",
  179: "UnsupportedProofVersion",
  182: "TransactionApplicationError (TTL expired / duplicate intent)",
  185: "PedersenCheckFailure (binding commitment mismatch)",
  186: "EffectsCheckFailure",
  193: "ReplayProtectionViolation (duplicate intent already submitted)",
  195: "InputNotInUtxos (input already spent / stale state)",
  196: "DustDoubleSpend",
};

// Extracts the inner `N` from "Custom error: N" (or "Custom(N)") strings that
// the RPC `data` field carries, and maps it to the named node error.
export function decodeCustomError(text: string | unknown): string | null {
  const str = typeof text === "string" ? text : text != null ? String(text) : "";
  const m = str.match(/Custom\s*error[:\s]*(\d+)/i) ?? str.match(/Custom\((\d+)\)/);
  if (!m) return null;
  const code = Number(m[1]);
  return `Custom error ${code} = ${MIDNIGHT_ERROR_CODES[code] ?? `unmapped node code ${code}`}`;
}

// JSON-dumps an unknown value safely (handles bigint, cycles, and Exceptions).
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "bigint") return `${val.toString()}n`;
        if (typeof val === "object" && val !== null) {
          if (seen.has(val as object)) return "[Circular]";
          seen.add(val as object);
        }
        return val;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

// Walks the error/cause chain and dumps EVERY field, so a network-level
// "Invalid Transaction" rejection surfaces its inner detail (error.data with
// "Custom error: N", error.code, Effect _tag/FiberFailure causes, ...) instead
// of just the top message. Effect errors (wallet-sdk) are plain objects with
// `_tag` + `cause`, not `Error` instances — walk those too.
export function dumpError(context: string, err: unknown): void {
  let current: unknown = err;
  let depth = 0;
  const seen = new Set<object>();
  while (current !== undefined && current !== null && depth < 10) {
    const e = current as Record<string, unknown>;
    if (typeof e === "object") {
      if (seen.has(e as object)) {
        console.error(`[contract] ${context} (cause ${depth}): [Circular]`);
        break;
      }
      seen.add(e as object);
    }

    const isError = e instanceof Error;
    const raw = { ...e };
    if (isError) {
      raw.stack = (e as Error).stack;
      if ((e as Error).cause !== undefined) raw.cause = (e as Error).cause;
    }
    const decoded = decodeCustomError(e?.data ?? e?.message ?? (e as { data?: unknown })?.data);

    console.error(`[contract] ${context}${depth === 0 ? "" : ` (cause ${depth})`}`, {
      name: isError ? (e as Error).name : e?.name ?? e?._tag ?? typeof e,
      message: isError ? (e as Error).message : e?.message ?? String(e),
      _tag: e?._tag,
      code: e?.code,
      data: e?.data,
      ...(decoded ? { decodedNodeError: decoded } : {}),
      fields: Object.keys(raw).length > 0 ? safeStringify(raw) : undefined,
    });

    // Next link: Error.cause, then a plain `cause` field (Effect style).
    let cause: unknown = undefined;
    if (isError && (e as Error).cause !== undefined) {
      cause = (e as Error).cause;
    } else if (e && typeof e === "object" && "cause" in e) {
      cause = e.cause;
    }
    current = cause;
    depth += 1;
  }
  // Always capture the fully-rendered error as one blob for copy-paste.
  console.error(`[contract] ${context} — FULL ERROR`, safeStringify(err));
}

// ---------- Providers ----------

let providersPromise: Promise<MidnightProviders> | null = null;

async function buildProviders(): Promise<MidnightProviders> {
  const api = await getConnectedAPI();
  if (!api) {
    throw new Error("1AM wallet not connected. Connect your wallet before creating an agreement.");
  }

  const config = await api.getConfiguration();
  setNetworkId(config.networkId);
  console.log("[contract] wallet config", {
    networkId: config.networkId,
    indexerUri: config.indexerUri,
    substrateNodeUri: config.substrateNodeUri,
  });

  const zkConfigProvider = new FetchZkConfigProvider(`${window.location.origin}/api/zk`, fetch.bind(window));

  const publicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);

  // Prove against our OWN local proof server instead of the 1AM wallet's
  // hosted ProofStation. The local instance is midnightntwrk/proof-server:8.0.3
  // on 127.0.0.1:6300 — the exact same image + version scripts/deploy.mts used
  // to deploy this contract, so proofs are guaranteed to match the ledger
  // version and verify on-chain (the wallet's ProofStation currently emits
  // proofs the node rejects with Custom error 115 = InvalidProof).
  //
  // Browser requests go through the same-origin /api/proof proxy (CORS-safe)
  // which forwards to the local proof server; key material is fetched from our
  // own /api/zk route via zkConfigProvider. The 1AM wallet is still used for
  // balancing (signatures + dust) and submission below.
  const provingProvider = httpClientProvingProvider(
    `${window.location.origin}/api/proof`,
    zkConfigProvider,
  );

  const proofProvider = {
    async proveTx(unprovenTx: any): Promise<any> {
      try {
        console.log("[contract] proving transaction (local proof server)...");
        const proven = await unprovenTx.prove(provingProvider, CostModel.initialCostModel());
        console.log("[contract] transaction proved", {
          txId: proven.identifiers?.()[0],
          bytes: (proven.serialize() as Uint8Array).length,
        });
        return proven;
      } catch (err) {
        dumpError("proveTx failed", err);
        throw err;
      }
    },
  };

  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await api.getShieldedAddresses();

  const walletProvider = {
    getCoinPublicKey: () => shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey,
    async balanceTx(tx: any): Promise<any> {
      const serialized = tx.serialize() as Uint8Array;
      try {
        console.log("[contract] balancing transaction (wallet pays dust)", { bytes: serialized.length });
        const result = await api.balanceUnsealedTransaction(bytesToHex(serialized));
        const balanced = Transaction.deserialize("signature", "proof", "binding", hexToBytes(result.tx));
        const balancedSerialized = balanced.serialize() as Uint8Array;
        console.log("[contract] transaction balanced", {
          txId: balanced.identifiers?.()[0],
          bytes: balancedSerialized.length,
          returnedBytes: (result.tx.length / 2) | 0,
        });
        return balanced;
      } catch (err) {
        dumpError("balanceTx failed", err);
        throw err;
      }
    },
  };

  const midnightProvider = {
    async submitTx(tx: any): Promise<string> {
      const serialized = tx.serialize() as Uint8Array;
      const txId = tx.identifiers()[0];
      console.log("[contract] submitting transaction", { txId, bytes: serialized.length });
      try {
        await api.submitTransaction(bytesToHex(serialized));
        console.log("[contract] transaction submitted", { txId });
        return txId;
      } catch (err) {
        console.error("[contract] network rejected transaction", { txId, bytes: serialized.length });
        dumpError("submitTx failed", err);
        throw err;
      }
    },
  };

  return {
    privateStateProvider: createPrivateStateProvider(),
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  } as MidnightProviders;
}

export function getProviders(): Promise<MidnightProviders> {
  if (!providersPromise) {
    providersPromise = buildProviders().finally(() => {
      providersPromise = null;
    });
  }
  return providersPromise;
}

// ---------- Deployed contract ----------

let deployedContractPromise: Promise<any> | null = null;

// Finds the deployed contract and returns an object whose `callTx` mirrors the
// contract's exported circuits (createAgreement, signAgreement, isSigned).
export function getDeployedContract(): Promise<any> {
  if (!deployedContractPromise) {
    deployedContractPromise = (async () => {
      const providers = await getProviders();
      const compiledContract = CompiledContract.withWitnesses<any, any, any>(
        CompiledContract.make<any, any, any>("agreement", Contract as any),
        {
          mySecretKey: () => [undefined, getLocalSecretKeyBytes()] as [undefined, Uint8Array],
        },
      );
      return (findDeployedContract as any)(providers, {
        contractAddress: CONTRACT_ADDRESS,
        compiledContract,
      });
    })().finally(() => {
      deployedContractPromise = null;
    });
  }
  return deployedContractPromise;
}

// ---------- Live state diagnostics ----------

// Fetches the CURRENT on-chain contract state straight from the indexer
// (no-cache, see midnight-js-indexer-public-data-provider) and reports the
// serialized bytes. This is the same query path submitCallTx uses to build the
// transaction, so it proves the tx is constructed against the freshest state
// the indexer knows — and lets us compare before/after a failed submission.
// Contract state is NOT decoded here (ledger decoding needs the compiled
// contract runtime); callers get hex + lengths for correlation.
export async function getCurrentContractStateHex(): Promise<{
  fetchedAt: string;
  contractStateHex: string;
  contractStateBytes: number;
  zswapStateHex: string;
  zswapStateBytes: number;
}> {
  const providers = await getProviders();
  const states = await providers.publicDataProvider.queryZSwapAndContractState(CONTRACT_ADDRESS as any);
  if (!states) {
    throw new Error(`No on-chain state found for contract ${CONTRACT_ADDRESS}`);
  }
  const [zswapChainState, contractState] = states;
  const contractStateHex = bytesToHex(contractState.serialize());
  const zswapStateHex = bytesToHex(zswapChainState.serialize());
  return {
    fetchedAt: new Date().toISOString(),
    contractStateHex,
    contractStateBytes: contractStateHex.length / 2,
    zswapStateHex,
    zswapStateBytes: zswapStateHex.length / 2,
  };
}
