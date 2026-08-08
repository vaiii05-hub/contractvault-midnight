// src/lib/buildCreateAgreement.ts
import { CreateAgreementInput } from "./types";

// Hashes text using SHA-256 (Web Crypto API — built into the browser,
// no extra libraries needed). Returns a 32-byte hex string, matching
// the Bytes<32> shape the contract expects for termsFingerprint.
export async function hashTerms(terms: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(terms);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The real agreement text is never sent on-chain — only its hash is.
// It's stored alongside the agreement record (see api.ts) so each party
// can read it again on the Agreement Detail page.

// Basic validation — a Bytes<32> hex string must be exactly 64 hex chars.
function isValidHex32(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value.trim());
}

export interface CreateAgreementPayload {
  partyBId: string;         // validated hex string, ready for the contract call
  termsFingerprint: string; // hex string, ready for the contract call
}

// Prepares everything needed to call the contract's createAgreement circuit.
// Throws if partyBId isn't a valid 32-byte hex value, so bad input is
// caught here instead of failing deep inside a transaction later.
export async function buildCreateAgreementPayload(
  input: CreateAgreementInput
): Promise<CreateAgreementPayload> {
  const partyBId = input.partyBId.trim();

  if (!isValidHex32(partyBId)) {
    throw new Error(
      "Party B's ID looks wrong — it should be a 64-character code they copied from their own wallet page."
    );
  }

  if (!input.terms.trim()) {
    throw new Error("Agreement terms can't be empty.");
  }

  const termsFingerprint = await hashTerms(input.terms);

  return { partyBId, termsFingerprint };
}