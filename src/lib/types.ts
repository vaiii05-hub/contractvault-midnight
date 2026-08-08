// src/lib/types.ts

export enum AgreementStatus {
  PENDING = "PENDING",
  SIGNED = "SIGNED",
}

// Mirrors the `Agreement` struct in agreement.compact
export interface Agreement {
  id: string;                // Uint<64> from the ledger, kept as a string in JS (avoids bigint precision issues)
  partyA: string;             // Bytes<32> hex — derived from creator's local secret key
  partyBId: string;           // Bytes<32> hex — derived from the invitee's local secret key
  termsFingerprint: string;   // Bytes<32> hex — hash of the agreement text (the text itself is NOT on-chain)
  status: AgreementStatus;
  // Mock-only: the full terms text, stored in the agreement record so
  // either party can read them in this single-browser demo. Not part of
  // the on-chain ledger — the fingerprint above stays the on-chain truth.
  terms: string;
}

// Form input when Party A creates a new agreement
export interface CreateAgreementInput {
  partyBId: string;   // hex string Party A pastes in, given to them by Party B
  terms: string;       // raw agreement text (hashed before going on-chain)
}

// Wallet connection state used across pages
export interface WalletState {
  address: string | null;
  connected: boolean;
}