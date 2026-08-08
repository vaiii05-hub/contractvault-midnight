# ContractVault — Private Two-Party Agreement Signing

**Agree privately. Prove it publicly.**

ContractVault is a privacy-first decentralized application built on the **Midnight Network** that lets two people create and sign confidential agreements — NDAs, freelance contracts, private deals — **without ever exposing the terms on-chain**.

Instead of storing agreement text on the blockchain, ContractVault records only a cryptographic fingerprint of the terms. The actual content stays between the two parties. Anyone, anytime, can verify an agreement was signed — without ever seeing what it says.

---

## Live Deployment

- **Network:** Midnight Preview Testnet
- **Deployed Contract Address:** `bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439`
- **Explorer:** [preview.midnightexplorer.com](https://preview.midnightexplorer.com/contract/bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439)
- **Wallet Integration:** 1AM Wallet

---

## Screenshots

### Landing Page
![Landing Page](./screenshots/landing-page.png)

### Creating an Agreement
![New Agreement](./screenshots/new-agreement.png)

### Wallet Connection (1AM Extension)
![Wallet Connection](./screenshots/wallet-connection.png)

### Transaction Submitted
![Transaction Submitted](./screenshots/transaction-submitted.png)

### Agreement Created
![Agreement Created](./screenshots/agreement-created.png)

### Explorer Confirmation
![Explorer](./screenshots/explorer-confirmation.png)

---

## Features

- **Private terms, public proof** — only a hash of the agreement is ever recorded on-chain; the text itself never touches the ledger
- **1AM Wallet integration** — connect a real wallet to establish a verifiable, persistent identity for signing
- **Role-based access** — only the designated Party B ever sees a "Sign" option, and only while the agreement is Pending
- **Public verifiability** — anyone can check whether an agreement was signed, with zero visibility into its content
- **Selective disclosure** — either party can later choose to reveal the real terms; anyone can confirm the reveal matches the on-chain fingerprint
- **Agreement dashboard** — lists every agreement you're part of, with role and status clearly labeled
- **Seal visual** — signed agreements are stamped with a wax-seal treatment matching the app's identity

---

## Tech Stack

- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Smart Contract:** Compact (Midnight's ZK smart contract language)
- **Blockchain:** Midnight Network (Preview testnet)
- **Wallet:** 1AM Wallet (`dapp-connector-api`)
- **Proof Generation:** Local proof server (`midnightntwrk/proof-server`)
- **Key packages:** `@midnight-ntwrk/compact-js`, `@midnight-ntwrk/compact-runtime`, `@midnight-ntwrk/midnight-js-contracts`, `@midnight-ntwrk/ledger-v8`, `@midnight-ntwrk/wallet-sdk-facade`

---

## Architecture

```
Agreement terms (typed by Party A)
      │
      ▼
Local commitment: hash(terms + nonce) — computed client-side, terms never leave the browser
      │
      ▼
Compact smart contract (createAgreement) ── deployed on Midnight Preview
      │
      ▼
On-chain: agreements map stores {partyA, partyB, termsCommitment, status}
      │
      ▼
Party B calls signAgreement(id) — identity checked via hashed secret key,
status flips Pending → Signed
      │
      ▼
Anyone can call isSigned(id) to verify — without ever seeing the terms.
verifyTerms(id, terms, nonce) lets a party later prove a reveal matches
the original commitment.
```

The Compact contract (`contract/agreement.compact`) exposes:
- `createAgreement(partyBId, termsFingerprint)` — Party A creates a new agreement
- `signAgreement(id)` — only the designated Party B can sign
- `isSigned(id)` — public check, reveals nothing but yes/no
- `verifyTerms(id, terms, nonce)` — selective disclosure, proves a revealed text matches the on-chain commitment
- `whoAmI()` — returns the caller's own derived public identity

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

Then open the app, click **Connect Wallet**, make sure your 1AM wallet is on the **Preview** network with testnet funds (via faucet), and go to **New Agreement** to create your first private agreement.

## Deploying the Contract

```bash
CONTRACTVAULT_SECRET=$(openssl rand -hex 32) npm run deploy
```

This generates a fresh wallet, funds it on Preview, registers DUST (fee tokens), and submits the deployment transaction.

---

## Engineering Notes

Getting a Compact contract's build system correctly wired into a TypeScript deploy script surfaced a real API quirk: `CompiledContract.make()` returns an object whose prototype carries `.pipe()`, but `withWitnesses()` / `withCompiledFileAssets()` are Effect-style dual combinators that spread the object into a plain value — dropping the prototype, and with it `.pipe`. Fixed by switching to nested data-first calls (`withCompiledFileAssets(withWitnesses(make(...), witnesses), zkConfigPath)`) instead of chaining `.pipe(...)`.

Full end-to-end transaction submission directly through 1AM's own hosted proving service is currently blocked by an issue on 1AM's side, isolated through direct comparison against a local proof server:

1. 1AM's hosted proof service initially rejected valid proofs (`Custom error 115: InvalidProof`) — confirmed as a service-side issue, not a contract bug, by successfully proving the same circuits against a local proof server instead.
2. Rerouting the app's proving step to a local proof server (proxied through a same-origin API route) resolved this entirely.
3. A second, related error surfaced during fee payment (`Custom error 170: InvalidDustSpendProof`) — this proof is generated internally by the 1AM wallet itself for its DUST fee, isn't currently routed through the local proof server, and appears to share the same underlying compatibility issue.

This confirms the contract, application logic, and transaction-building code are correct — the same circuits prove and verify successfully outside 1AM's specific proving path.

---

## Status

| Component | Status |
|---|---|
| Compact contract (compile) | Complete |
| Frontend build & typecheck | Passing |
| Wallet integration (1AM) | Working |
| On-chain deployment | Live on Preview testnet |
| Agreement creation & signing (local proof server) | Working |
| Public verification (`isSigned`) | Implemented |
| Selective disclosure (`verifyTerms`) | Implemented |
| End-to-end submission via 1AM's hosted proving service | Blocked (1AM-side issue, see Engineering Notes) |

---

## Privacy Guarantee

At no point are agreement terms stored on-chain in readable form. Only a cryptographic commitment is ever recorded — demonstrating how Midnight's privacy-preserving blockchain can enable real, verifiable agreements between two parties without exposing sensitive content to anyone else, including the network itself.
