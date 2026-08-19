# ContractVault — Private Two-Party Agreement Signing

**Agree privately. Prove it publicly.**

ContractVault is a privacy-first decentralized application built on the Midnight Network that lets two people create and sign confidential agreements — NDAs, freelance contracts, private deals — without ever exposing the terms on-chain.

Instead of storing agreement text on the blockchain, ContractVault records only a cryptographic fingerprint of the terms. The actual content stays between the two parties. Anyone, anytime, can verify an agreement was signed, without ever seeing what it says.

## Initial Product Idea

Right now, when two people want proof they agreed to something, they either use paper contracts (easy to lose or dispute) or a fully public on-chain system (which exposes private business terms to anyone, including competitors). ContractVault lets two parties privately store an agreement and sign it on-chain — the content stays confidential forever, but the fact that a deal was made and signed can be proven at any time, by anyone, without revealing what was agreed to. This is useful for NDAs, freelance contracts, rental agreements, or any two-party arrangement where privacy of terms matters but proof of agreement still needs to be trustworthy and verifiable.

---

## Live Deployment

- **Network:** Midnight Preview Testnet
- **Deployed Contract Address:** `bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439`
- **Explorer:** [preview.midnightexplorer.com](https://preview.midnightexplorer.com/contract/bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439)
- **Wallet Integration:** 1AM Wallet

![Explorer confirmation](./screenshots/explorer-confirmation.png)

---

## Compile Output

Compiling 3 circuits:
circuit "createAgreement" (k=13, rows=4726)
circuit "isSigned" (k=7, rows=120)
circuit "signAgreement" (k=13, rows=4252)
Overall progress [====================] 3/3


![Compile output](./screenshots/compile-output.png)

---

## Screenshots

### Landing Page
![Landing Page](./screenshots/landing-page.png)

### Wallet Connection (1AM Extension)
![Wallet Connection](./screenshots/wallet-connection.png)

### Creating an Agreement
![New Agreement](./screenshots/new-agreement.png)

### Agreement Created
![Agreement Created](./screenshots/agreement-created.png)

### Transaction Submitted
![Transaction Submitted](./screenshots/transaction-submitted.png)

---

## Smart Contract

The contract is located at `contract/agreement.compact` and exposes three circuits:

- `createAgreement(partyBId, termsFingerprint)` — Party A creates a new agreement, specifying Party B and a fingerprint of the terms (not the terms themselves)
- `signAgreement(id)` — only the designated Party B can sign, transitioning status from Pending to Signed
- `isSigned(id)` — a public, callable check that returns signature status without revealing any agreement content

### Public State vs Private Witness

This contract deliberately separates what is public from what stays private, using Compact's `ledger` and `witness` constructs.

**Public ledger state** (visible to anyone on-chain):
- `agreements: Map<Uint<64>, Agreement>` — stores each agreement's Party A identifier, Party B identifier, a fingerprint of the terms, and its status (Pending/Signed)
- `nextId: Counter` — tracks agreement IDs

**Private witness** (never leaves the caller's device):
- `mySecretKey(): Bytes<32>` — a secret value known only to the caller, used to derive a public identity via a `persistentHash`-based circuit, without ever exposing the secret itself

The actual agreement terms are never passed into the contract at all — only a fingerprint (hash) of them is computed client-side and stored on-chain. This is a deliberate design: `disclose()` is used only on the fields meant to become public (the fingerprint, party identifiers, status) — the real terms text never touches the ledger, so there is nothing to leak even if the entire chain were inspected.

```compact
witness mySecretKey(): Bytes<32>;

circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "agreement:pk"), sk]);
}

export circuit createAgreement(partyBId: Bytes<32>, termsFingerprint: Bytes<32>): [] {
  const myId = publicKey(mySecretKey());
  const id = nextId;
  agreements.insert(disclose(id), Agreement {
    partyA: disclose(myId),
    partyBId: disclose(partyBId),
    termsFingerprint: disclose(termsFingerprint),
    status: Status.PENDING
  });
  nextId.increment(1);
}
```

### Access Control: Who Can Sign

- **Party A (creator)** can never sign their own agreement — only view it and share the Agreement ID with Party B.
- **Party B** sees a sign option, but only while the agreement is Pending.
- Once signed, the option disappears for everyone — the agreement is sealed permanently.

```compact
export circuit signAgreement(id: Uint<64>): [] {
  const myId = publicKey(mySecretKey());
  const agreement = agreements.lookup(disclose(id));
  assert(agreement.partyBId == myId, "only Party B can sign this agreement");
  assert(agreement.status == Status.PENDING, "agreement is already signed");
  agreements.insert(disclose(id), Agreement {
    partyA: agreement.partyA,
    partyBId: agreement.partyBId,
    termsFingerprint: agreement.termsFingerprint,
    status: Status.SIGNED
  });
}
```

---

## Features

- **Private terms, public proof** — only a fingerprint of the agreement is ever recorded on-chain; the text itself never touches the ledger
- **1AM Wallet integration** — connects a real wallet on Midnight Preview to establish a verifiable, persistent identity for signing
- **Role-based access** — only the designated Party B ever sees a sign option, and only while the agreement is Pending
- **Public verifiability** — anyone can check whether an agreement was signed, with zero visibility into its content
- **Agreement dashboard** — lists every agreement the connected wallet is part of, with role and status clearly labeled
- **Seal visual** — signed agreements are marked with a wax-seal treatment matching the app's identity

---

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Smart Contract:** Compact (Midnight's ZK smart contract language)
- **Blockchain:** Midnight Network (Preview testnet)
- **Wallet:** 1AM Wallet (`dapp-connector-api`)
- **Proof Generation:** Local proof server (`midnightntwrk/proof-server`)
- **Key packages:** `@midnight-ntwrk/compact-js`, `@midnight-ntwrk/compact-runtime`, `@midnight-ntwrk/midnight-js-contracts`, `@midnight-ntwrk/ledger-v8`, `@midnight-ntwrk/wallet-sdk-facade`

---

## Architecture

Agreement terms (typed by Party A)

↓

Fingerprint computed client-side — terms never leave the browser

↓

Compact smart contract (`createAgreement`) — deployed on Midnight Preview

↓

On-chain: `agreements` map stores:
- `partyA`
- `partyB`
- `termsFingerprint`
- `status`

↓

Party B calls `signAgreement(id)` — identity checked via derived public key

↓

Status flips: `Pending` → `Signed`

↓

Anyone can call `isSigned(id)` to verify — without ever seeing the terms

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the local proof server (Docker)
docker run -d --name proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3

# Run the app
npm run dev
```

Open the app, click Connect Wallet, make sure your 1AM wallet is on the Preview network with testnet funds (via faucet), then go to New Agreement to create your first private agreement.

## Deploying the Contract

```bash
CONTRACTVAULT_SECRET=$(openssl rand -hex 32) npm run deploy
```

This generates a fresh wallet, funds it on Preview via the faucet, registers DUST (fee tokens) from the NIGHT balance, and submits the deployment transaction.

---
## Testing

`contract/agreement.test.ts` exercises the compiled contract's circuits directly against `compact-runtime`'s in-memory `CircuitContext` — no network, wallet, or proof server required. It covers:

- Creating an agreement and verifying the resulting ledger state (status `PENDING`, correct `partyA`/`partyB`/terms fingerprint)
- Signing by the correct Party B, verifying status flips to `SIGNED` and `isSigned` returns `true`
- Rejecting a second sign attempt on an already-signed agreement
- Rejecting a sign attempt from an unauthorized signer

Run it with:

```bash
npm test
```

## Engineering Notes

Getting the Compact contract's build output correctly wired into a TypeScript deploy script surfaced a real API quirk: `CompiledContract.make()` returns an object whose prototype carries `.pipe()`, but `withWitnesses()` and `withCompiledFileAssets()` are Effect-style dual combinators that spread the object into a plain value, dropping the prototype and with it `.pipe`. Fixed by switching to nested data-first calls (`withCompiledFileAssets(withWitnesses(make(...), witnesses), zkConfigPath)`) instead of chaining `.pipe(...)`.

Full end-to-end transaction submission directly through 1AM's own hosted proving service was blocked by an issue on 1AM's side, isolated through direct comparison against a local proof server:

1. 1AM's hosted proof service initially rejected valid proofs with `Custom error 115: InvalidProof`. Confirmed as a service-side compatibility issue, not a contract bug, by successfully proving the same circuits against a local proof server instead.
2. Rerouting the app's proving step to a local proof server (proxied through a same-origin API route) resolved this entirely — the contract's own proof now generates and verifies correctly.
3. A second, related error surfaced during fee payment: `Custom error 170: InvalidDustSpendProof`. This proof is generated internally by the 1AM wallet itself for its DUST fee, isn't currently routed through the local proof server, and appears to share the same underlying compatibility issue.

This confirms the contract, application logic, and transaction-building code are correct — the same circuits prove and verify successfully outside 1AM's specific proving path.

---

## Status

| Component | Status |
|---|---|
| Compact contract (compile) | Complete — 3/3 circuits |
| Frontend build and typecheck | Passing |
| Wallet integration (1AM) | Working |
| On-chain deployment | Live on Preview testnet |
| Agreement creation and signing (local proof server) | Working |
| Public verification (`isSigned`) | Implemented |
| End-to-end submission via 1AM's hosted proving service | Blocked (1AM-side issue, see Engineering Notes) | Contract logic tests (`npm test`) | Passing (3/3) |

---

## Project Structure

contract/
agreement.compact Compact smart contract source
build/ Compiled contract, proving/verifying keys
managed/ Compiled circuits and keys

scripts/
deploy.mts Deployment script

src/
app/
page.tsx Home / Vault
new-agreement/ Create agreement form
my-agreements/ Agreement list
agreement/[id]/ Agreement detail and sign
api/proof/ Local proof server proxy route
api/zk/ ZK key material serving route
lib/
api.ts Application logic (create, sign, list)
contract.ts Contract client, wallet and proof provider wiring
wallet.ts 1AM wallet connection
types.ts Shared TypeScript types
components/ UI components (header, footer, seal, wallet nav)


---

## Privacy Guarantee

At no point are agreement terms stored on-chain in readable form. Only a cryptographic fingerprint is ever recorded, demonstrating how Midnight's privacy-preserving blockchain can enable real, verifiable agreements between two parties without exposing sensitive content to anyone else, including the network itself.
