// src/lib/api.ts
import { CompactTypeBytes, CompactTypeVector, persistentHash } from "@midnight-ntwrk/compact-runtime";
import { Agreement, AgreementStatus, CreateAgreementInput } from "./types";
import { buildCreateAgreementPayload } from "./buildCreateAgreement";
import { buildSignAgreementPayload } from "./buildSignAgreement";
import {
  getDeployedContract,
  getCurrentContractStateHex,
  bytesToHex,
  hexToBytes,
  dumpError,
} from "./contract";
import { ledger } from "../../contract/build/contract/index.js";
import { getLocalSecretKeyBytes } from "./wallet";

// =====================================================================
// PARTIAL ON-CHAIN MODE — createAgreement now transacts against the
// deployed contract (see src/lib/contract.ts). The read/sign functions
// (signAgreement, isSigned, getMyAgreements, getAgreementById) still run
// on localStorage until they are wired to the indexer; createAgreement
// mirrors each on-chain record locally so those functions keep working.
// The function signatures below are what the pages call either way, so
// pages don't need to change later.
// =====================================================================

const MOCK_STORAGE_KEY = "contractvault_mock_agreements";

function readMockAgreements(): Agreement[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeMockAgreements(agreements: Agreement[]): void {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(agreements));
}

// Derives this browser's public id the same way the contract's publicKey
// circuit does — by calling the exact same @midnight-ntwrk/compact-runtime
// persistentHash function the compiled contract uses, with the same type
// descriptor (Vector<2, Bytes<32>>) and the same pad("agreement:pk", 32)
// prefix. This guarantees the derived id matches partyA/partyBId on-chain
// exactly (no reimplementation of the hash). See contract/build/contract/
// index.js — _publicKey_0 — which the verification below mirrors byte-for-byte.
export async function getMyPartyId(): Promise<string> {
  const prefix = new Uint8Array(32);
  new TextEncoder().encodeInto("agreement:pk", prefix);
  const id = persistentHash(
    new CompactTypeVector(2, new CompactTypeBytes(32)),
    [prefix, getLocalSecretKeyBytes()]
  );
  return Array.from(id)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- createAgreement ----------
// Submits a real createAgreement transaction against the deployed contract.
// The transaction is proved, balanced, and submitted by the 1AM wallet; the
// on-chain id comes from the contract's nextId counter.
export async function createAgreement(input: CreateAgreementInput): Promise<Agreement> {
  const { partyBId, termsFingerprint } = await buildCreateAgreementPayload(input);

  const partyBIdBytes = hexToBytes(partyBId);
  const termsFingerprintBytes = hexToBytes(termsFingerprint);

  // ---- Argument verification (must match the compiled createAgreement
  // circuit exactly: Bytes<32>, Bytes<32>; see contract/build/contract/index.js
  // _createAgreement_0 type guards: length === 32, BYTES_PER_ELEMENT === 1). ----
  const argChecks = {
    partyBIdLength: partyBIdBytes.length,
    termsFingerprintLength: termsFingerprintBytes.length,
    partyBIdValid: partyBIdBytes.length === 32 && partyBIdBytes.BYTES_PER_ELEMENT === 1,
    termsFingerprintValid:
      termsFingerprintBytes.length === 32 && termsFingerprintBytes.BYTES_PER_ELEMENT === 1,
  };
  if (!argChecks.partyBIdValid || !argChecks.termsFingerprintValid) {
    throw new Error(
      `createAgreement args invalid: ${JSON.stringify(argChecks)} — partyBId/termsFingerprint must be 32 bytes.`,
    );
  }
  console.log("[api] createAgreement args", {
    partyBId: partyBId.toLowerCase(),
    partyBIdBytes: partyBIdBytes.length,
    termsFingerprint: termsFingerprint.toLowerCase(),
    termsFingerprintBytes: termsFingerprintBytes.length,
    ...argChecks,
  });

  // ---- State freshness: query the LIVE on-chain state right now and log it,
  // so we have evidence of exactly what state this tx is built against. ----
  let liveState;
  try {
    liveState = await getCurrentContractStateHex();
    console.log("[api] live on-chain state before createAgreement", liveState);
  } catch (stateErr) {
    dumpError("querying live contract state", stateErr);
  }

  const myPartyId = await getMyPartyId();
  console.log("[api] derived partyA id", { myPartyId });

  const contract = await getDeployedContract();
  let result!: Awaited<ReturnType<typeof contract.callTx.createAgreement>>;
  try {
    result = await contract.callTx.createAgreement(partyBIdBytes, termsFingerprintBytes);
  } catch (err) {
    // The wallet/network wraps real failures (e.g. "Invalid Transaction") in
    // nested error objects; dump the whole cause chain for diagnosis. The RPC
    // `data` field carries "Custom error: N" — decodeCustomError maps it.
    dumpError("createAgreement callTx failed", err);

    // Did the on-chain state change between building the tx and the failure?
    // (If it did, a stale-state rejection is on the table; if it didn't, the
    // failure is a proof/construction issue, not stale state.)
    try {
      const after = await getCurrentContractStateHex();
      console.error("[api] on-chain state after failure", {
        beforeContractBytes: liveState?.contractStateBytes,
        afterContractBytes: after.contractStateBytes,
        beforeContractStateHash: liveState?.contractStateHex,
        afterContractStateHash: after.contractStateHex,
        stateUnchanged: liveState?.contractStateHex === after.contractStateHex,
      });
    } catch (stateErr) {
      dumpError("re-querying state after failure", stateErr);
    }
    throw err;
  }

  // Decode the resulting ledger state to learn the freshly-inserted id and
  // read back what the contract actually recorded.
  const state = ledger(result.public.nextContractState);
  const id = state.nextId - BigInt(1);
  const entry = state.agreements.lookup(id);
  console.log("[api] createAgreement succeeded", {
    txId: result.public?.txId ?? result.txId,
    id: id.toString(),
    nextId: state.nextId.toString(),
    agreementsSize: state.agreements.size().toString(),
  });

  const agreement: Agreement = {
    id: id.toString(),
    partyA: bytesToHex(entry.partyA),
    partyBId: bytesToHex(entry.partyBId),
    termsFingerprint: bytesToHex(entry.termsFingerprint),
    status: entry.status === 1 ? AgreementStatus.SIGNED : AgreementStatus.PENDING,
    terms: input.terms,
  };

  // Mirror the on-chain record locally: the read functions are still on
  // localStorage until they're wired to the indexer.
  const all = readMockAgreements();
  all.push(agreement);
  writeMockAgreements(all);

  return agreement;
}

// ---------- signAgreement ----------
export async function signAgreement(agreement: Agreement): Promise<Agreement> {
  buildSignAgreementPayload(agreement); // validates, throws if not allowed

  const idBigInt = BigInt(agreement.id);

  const contract = await getDeployedContract();
  let result!: Awaited<ReturnType<typeof contract.callTx.signAgreement>>;
  try {
    result = await contract.callTx.signAgreement(idBigInt);
  } catch (err) {
    dumpError("signAgreement callTx failed", err);
    throw err;
  }

  const state = ledger(result.public.nextContractState);
  const entry = state.agreements.lookup(idBigInt);

  console.log("[api] signAgreement succeeded", {
    txId: result.public?.txId ?? result.txId,
    id: agreement.id,
    status: entry.status,
  });

  const updated: Agreement = {
    ...agreement,
    partyA: bytesToHex(entry.partyA),
    partyBId: bytesToHex(entry.partyBId),
    termsFingerprint: bytesToHex(entry.termsFingerprint),
    status: entry.status === 1 ? AgreementStatus.SIGNED : AgreementStatus.PENDING,
  };

  const all = readMockAgreements();
  const idx = all.findIndex((a) => a.id === agreement.id);
  if (idx === -1) throw new Error("Agreement not found.");
  all[idx] = updated;
  writeMockAgreements(all);

  return updated;
}
// ---------- getAgreementById ----------
export async function getAgreementById(id: string): Promise<Agreement | null> {
  const all = readMockAgreements();
  return all.find((a) => a.id === id) || null;
}

// ---------- getMyAgreements ----------


// ---------- getMyAgreements ----------
export async function getMyAgreements(): Promise<Agreement[]> {
  const myPartyId = await getMyPartyId();
  const all = readMockAgreements();
  return all.filter(
    (a) =>
      a.partyA.toLowerCase() === myPartyId.toLowerCase() ||
      a.partyBId.toLowerCase() === myPartyId.toLowerCase()
  );
}
