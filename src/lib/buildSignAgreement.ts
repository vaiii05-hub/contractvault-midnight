// src/lib/buildSignAgreement.ts
import { AgreementStatus, Agreement } from "./types";

export interface SignAgreementPayload {
  id: string; // Uint<64> from the ledger, kept as string (see types.ts note)
}

// Prepares the input needed to call the contract's signAgreement circuit.
// Checks the agreement is actually still PENDING and that this looks like
// a real id, so we don't send a doomed transaction to the wallet.
export function buildSignAgreementPayload(
  agreement: Agreement
): SignAgreementPayload {
  if (!agreement.id || agreement.id.trim() === "") {
    throw new Error("Missing agreement id — can't sign.");
  }

  if (agreement.status === AgreementStatus.SIGNED) {
    throw new Error("This agreement is already signed.");
  }

  return { id: agreement.id };
}

// Convenience check used by the UI to decide whether to even show
// the "Sign" button — only Party B should see it, and only pre-signing.
export function canSign(agreement: Agreement, myPartyId: string): boolean {
  return (
    agreement.status === AgreementStatus.PENDING &&
    agreement.partyBId.toLowerCase() === myPartyId.toLowerCase()
  );
}