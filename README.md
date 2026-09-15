# ContractVault — Private Two-Party Agreement Signing

**Agree privately. Prove it publicly.**

ContractVault is a privacy-first decentralized application built on the **Midnight Network** that lets two people create and sign confidential agreements — such as NDAs, freelance contracts, rental agreements, and private deals — without exposing the agreement terms on-chain.

Instead of storing the agreement text on the blockchain, ContractVault records only a **cryptographic fingerprint** of the terms. The actual agreement content remains private between the two parties.

---

## Project Overview

### The Problem

Traditional agreements are usually stored using paper documents or centralized services. These approaches can make it difficult to prove that an agreement was signed while keeping sensitive business or personal terms private.

A fully public blockchain approach creates another problem: putting agreement details directly on-chain can expose confidential information to everyone.

### The Solution

ContractVault separates **proof of agreement** from **agreement content**.

```text
Agreement Terms
      │
      ▼
Private in the browser
      │
      ▼
Cryptographic Fingerprint
      │
      ▼
Midnight Smart Contract
      │
      ▼
Publicly verifiable agreement state
```

The agreement text itself never needs to be stored on-chain.

---

# Privacy Model

Privacy is the core purpose of ContractVault.

## What an observer CAN learn

An observer can verify:

* That an agreement transaction occurred
* The public contract state
* The agreement identifier
* The disclosed party identifiers
* The agreement status, such as Pending or Signed
* The cryptographic fingerprint stored for the agreement
* That the `signAgreement()` circuit was successfully executed

## What an observer CANNOT learn

An observer cannot see:

* The actual agreement text
* The confidential terms of the agreement
* The user's secret key
* Private witness data
* The underlying agreement content through the public transaction

The agreement terms are never passed into the smart contract. Only a cryptographic fingerprint is stored on-chain.

This allows ContractVault to provide **public proof without publicly revealing the agreement itself**.

---

# Live Demo

* **Live site:** https://contractvault-midnight.vercel.app
* **Demo video:** https://drive.google.com/file/d/1ypfY0VFVkpUA3Toj-vwsa_78pKeX1xAb/view?usp=sharing

### Demo flow

```text
Connect 1AM Wallet
        ↓
Create Agreement
        ↓
Agreement transaction
        ↓
Party B signs
        ↓
Status → SIGNED
        ↓
Anyone can verify the signed state
```

> **Demo note:** The live site's proof server runs on Render's free tier and may spin down after periods of inactivity. The first transaction after idle time can therefore take approximately 30–60 seconds while the service wakes up.

The 1AM wallet connector can also occasionally return an `InternalError`. The application includes automatic retry handling for transient connector failures.

---

# Level 2 Verification

## Network

**Midnight Preview Testnet**

## Wallet

**1AM Wallet**

## Deployed Contract

```text
bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439
```

## Verified Transaction

A real `signAgreement()` transaction has been successfully verified on-chain:

https://explorer.1am.xyz/tx/8e7cf4bfbbf7f1629fe0a7b6028e86a690db9bb39343a5f20b2594c646f0dc16

## Verified Functionality

* 1AM Wallet connection
* Agreement creation
* On-chain contract interaction
* Party B authorization
* Agreement signing
* Signed-state verification
* Privacy-preserving agreement design
* Public verification without exposing agreement terms

---

# Screenshots

## Landing Page

![Landing Page](./screenshots/landing-page.png)

## Wallet Connection

![Wallet Connection](./screenshots/wallet-connection.png)

## Creating an Agreement

![New Agreement](./screenshots/new-agreement.png)

## Agreement Created

![Agreement Created](./screenshots/agreement-created.png)

## Transaction Submitted

![Transaction Submitted](./screenshots/transaction-submitted.png)

## Explorer Confirmation

![Explorer confirmation](./screenshots/explorer-confirmation.png)

---

# Smart Contract

The Compact smart contract is located at:

```text
contract/agreement.compact
```

It exposes three main circuits.

### `createAgreement(partyBId, termsFingerprint)`

Party A creates a new agreement by specifying Party B and the cryptographic fingerprint of the agreement terms.

The agreement text itself is never passed to the contract.

### `signAgreement(id)`

Only the designated Party B can sign the agreement.

The circuit verifies the caller's derived public identity and changes the agreement status from:

```text
PENDING → SIGNED
```

### `isSigned(id)`

Provides a public way to check whether an agreement has been signed without revealing the agreement content.

---

# Public State vs Private Witness

ContractVault deliberately separates public ledger information from private witness information.

## Public Ledger State

The contract stores:

```text
agreements
├── partyA
├── partyB
├── termsFingerprint
└── status

nextId
```

These are the fields required for the agreement's public verification and contract logic.

## Private Witness

The contract uses:

```compact
witness mySecretKey(): Bytes<32>;
```

The secret key is known only to the caller.

A public identity is derived using a `persistentHash`-based circuit:

```compact
circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([
    pad(32, "agreement:pk"),
    sk
  ]);
}
```

The secret key itself is never exposed.

---

# Access Control

ContractVault uses role-based access control for signing.

### Party A

* Creates the agreement
* Cannot sign their own agreement
* Shares the Agreement ID with Party B

### Party B

* Is identified when the agreement is created
* Can sign only their designated agreement
* Can sign only while the agreement is Pending

### After Signing

Once Party B signs:

```text
PENDING
   ↓
SIGNED
```

The agreement is sealed and cannot be signed again.

---

# Public Verification

The public verification flow demonstrates the privacy model.

1. A transaction calls the `signAgreement()` circuit.
2. The transaction can be verified through the public explorer.
3. The explorer shows transaction information such as the transaction hash, block information, and fees.
4. The agreement's actual terms are not exposed.
5. Only the cryptographic fingerprint is associated with the agreement's on-chain state.
6. Anyone can use `isSigned(id)` to verify the signed state.

Therefore:

```text
Public Proof
     +
Private Agreement Content
     =
ContractVault
```

---

# Features

* **Private terms, public proof** — agreement text never touches the ledger
* **1AM Wallet integration** — real wallet connection on Midnight Preview
* **Role-based access** — only the designated Party B can sign
* **Public verifiability** — signed status can be checked without revealing terms
* **Agreement dashboard** — displays agreements involving the connected wallet
* **Signed agreement state** — completed agreements are permanently marked as Signed
* **Privacy-first architecture** — agreement content remains outside the public blockchain state

---

# Architecture

```text
Party A enters agreement terms
              │
              ▼
Terms remain private in browser
              │
              ▼
Cryptographic fingerprint generated
              │
              ▼
Compact Smart Contract
              │
              ▼
     createAgreement()
              │
              ▼
Public ledger stores:
  - Party A
  - Party B
  - Fingerprint
  - Status
              │
              ▼
Party B calls signAgreement()
              │
              ▼
Identity authorization checked
              │
              ▼
       PENDING → SIGNED
              │
              ▼
Anyone can call isSigned()
```

---

# Tech Stack

| Component               | Technology                         |
| ----------------------- | ---------------------------------- |
| Frontend                | Next.js, TypeScript, Tailwind CSS  |
| Smart Contract          | Compact                            |
| Blockchain              | Midnight Network — Preview Testnet |
| Wallet                  | 1AM Wallet / DApp Connector API    |
| Proof Generation        | `midnightntwrk/proof-server:8.0.3` |
| Local Proof Server      | Docker                             |
| Production Proof Server | Render                             |
| Deployment              | Vercel                             |

### Key Midnight packages

```text
@midnight-ntwrk/compact-js
@midnight-ntwrk/compact-runtime
@midnight-ntwrk/midnight-js-contracts
@midnight-ntwrk/ledger-v8
@midnight-ntwrk/wallet-sdk-facade
```

---

# Compile Output

The contract contains three circuits:

```text
createAgreement
k = 13
rows = 4726

isSigned
k = 7
rows = 120

signAgreement
k = 13
rows = 4252
```

Compilation completes successfully:

```text
Overall progress [====================] 3/3
```

![Compile output](./screenshots/compile-output.png)

---

# Testing

ContractVault includes contract-level tests in:

```text
contract/agreement.test.ts
```

The tests use Compact Runtime's in-memory `CircuitContext`, so they do not require a live network, wallet, or proof server.

The tests cover:

### Test 1 — Create Agreement

Verifies:

* Agreement creation
* Correct Party A
* Correct Party B
* Correct terms fingerprint
* Initial `PENDING` status

### Test 2 — Sign Agreement

Verifies:

* Correct Party B can sign
* Status changes to `SIGNED`
* `isSigned()` returns `true`

### Test 3 — Reject Invalid Signing

Verifies that invalid signing attempts are rejected, including:

* Signing an already-signed agreement
* Signing as an unauthorized user

Run the tests with:

```bash
npm test
```

Expected result:

```text
3/3 tests passing
```

---

# Getting Started

## 1. Install dependencies

```bash
npm install
```

## 2. Start the local proof server

```bash
docker run -d --name proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3
```

## 3. Start the application

```bash
npm run dev
```

Open the application and connect your 1AM Wallet.

Make sure the wallet is connected to the **Preview** network and has testnet funds.

Then navigate to **New Agreement**.

---

# Proof Server Configuration

For local development, the application can use:

```text
http://127.0.0.1:6300
```

For the live deployment, the proof server is hosted separately because a browser running on Vercel cannot access a proof server running on a developer's local machine.

The application uses the environment variable:

```text
PROOF_SERVER_URL
```

The production deployment uses the hosted Render proof server.

---

# Contract Deployment

The deployment script can be executed with:

```bash
CONTRACTVAULT_SECRET=$(openssl rand -hex 32) npm run deploy
```

The deployment process generates a wallet, funds it through the Preview faucet, registers DUST from the NIGHT balance, and submits the contract deployment transaction.

---

# Engineering Notes

During development, several issues were identified and resolved.

### Compact build API

`CompiledContract.make()` returns an object whose prototype provides `.pipe()`. Some Effect-style combinators can turn the result into a plain value and remove that prototype.

The deployment code was therefore changed to use nested data-first calls instead of chaining `.pipe()`.

### Proof generation

An initial hosted proving path returned:

```text
Custom error 115: InvalidProof
```

The same circuits successfully generated and verified proofs using the local proof server, which isolated the issue from the Compact contract itself.

The application was subsequently configured to use the same proof-server image through a hosted Render service for production.

### DUST proof issue

A separate:

```text
Custom error 170: InvalidDustSpendProof
```

was observed during wallet fee handling.

This proof is generated internally by the 1AM wallet and is separate from the application's own proof-server requests.

### Wallet connector retry

The 1AM DApp Connector can occasionally return:

```text
InternalError
```

The application includes retry handling for transient connector failures before displaying an error to the user.

---

# Current Project Status

| Component                      | Status                  |
| ------------------------------ | ----------------------- |
| Compact contract compilation   | Complete — 3/3 circuits |
| Frontend build/typecheck       | Passing                 |
| 1AM Wallet integration         | Working                 |
| Midnight deployment            | Live on Preview         |
| Agreement creation             | Working                 |
| Agreement signing              | Working                 |
| Public `isSigned` verification | Implemented             |
| Contract tests                 | Passing — 3/3           |
| Live Vercel deployment         | Working                 |
| Hosted proof server            | Working                 |
| Real on-chain transaction      | Verified                |

---

# Project Structure

```text
contract/
├── agreement.compact
├── agreement.test.ts
├── build/
├── managed/
└── ...

scripts/
└── deploy.mts

src/
├── app/
│   ├── page.tsx
│   ├── new-agreement/
│   ├── my-agreements/
│   ├── agreement/[id]/
│   └── api/
│       ├── proof/
│       └── zk/
│
├── lib/
│   ├── api.ts
│   ├── contract.ts
│   ├── wallet.ts
│   └── types.ts
│
└── components/
    ├── header
    ├── footer
    ├── seal
    └── wallet navigation
```

---

# Privacy Guarantee

ContractVault is designed around one simple privacy principle:

> **The agreement terms should remain private while the fact that the agreement was signed can be publicly verified.**

At no point are the actual agreement terms stored on-chain in readable form.

Only a cryptographic fingerprint is recorded as part of the public contract state.

This demonstrates how Midnight's privacy-preserving blockchain can be used to build applications where **confidential information remains private while selected facts remain publicly verifiable**.

---

# Project Links

**Live Demo:**
https://contractvault-midnight.vercel.app

**GitHub Repository:**
https://github.com/vaiii05-hub/contractvault-midnight

**Demo Video:**
https://drive.google.com/file/d/1ypfY0VFVkpUA3Toj-vwsa_78pKeX1xAb/view?usp=sharing

**Verified Transaction:**
https://explorer.1am.xyz/tx/8e7cf4bfbbf7f1629fe0a7b6028e86a690db9bb39343a5f20b2594c646f0dc16

**Contract Address:**

```text
bac2223389e3479fa28736ce49a69c53842b69940c0a7a1161480e53c7020439
```

**Network:** Midnight Preview Testnet

**Wallet:** 1AM Wallet
