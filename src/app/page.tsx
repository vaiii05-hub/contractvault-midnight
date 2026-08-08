// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getConnectedAddress } from "@/lib/wallet";
import { WaxSeal } from "@/components/Seal";
import { MidnightMark } from "@/components/icons";

const steps = [
  {
    n: "01",
    title: "Connect your wallet",
    body: "Link the 1AM wallet to provision your identity on the Midnight Network.",
  },
  {
    n: "02",
    title: "Create or receive an ID",
    body: "Draft a new agreement, or share your Agreement ID so someone can add you as Party B.",
  },
  {
    n: "03",
    title: "Party B signs",
    body: "The counterparty seals it. The terms stay hidden — only the fingerprint is recorded.",
  },
  {
    n: "04",
    title: "Verify the seal",
    body: "Anyone can confirm the agreement was signed, without ever seeing its terms.",
  },
];

export default function HomePage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getConnectedAddress().then((addr) => {
      if (addr) setConnected(true);
    });

    // Stay in sync when the navbar connects/disconnects the wallet.
    const onWallet = () => {
      getConnectedAddress().then((addr) => setConnected(Boolean(addr)));
    };
    window.addEventListener("contractvault:wallet", onWallet);
    return () => window.removeEventListener("contractvault:wallet", onWallet);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-10 pt-12 sm:pt-16">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-line bg-ink-900 shadow-[0_0_60px_rgb(62_175_135/0.14)]">
          <WaxSeal state={connected ? "signed" : "pending"} size={44} />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-text sm:text-5xl">
          ContractVault
        </h1>
        <p className="mt-3 max-w-md text-balance text-sm text-ink-muted sm:text-base">
          Two parties. One confidential agreement. The terms stay private — only
          the seal is ever public.
        </p>
      </div>

      {/* About Midnight */}
      <section className="mt-12 w-full max-w-2xl rounded-2xl border border-line bg-ink-900/40 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-850 text-seal-bright">
            <MidnightMark size={22} />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink-text">
            Built on the Midnight Network
          </h2>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          ContractVault runs on Midnight, a blockchain built for data protection.
          Agreements are signed with cryptographic proofs rather than exposed
          for anyone to read, so sensitive terms never need to be public.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          The result: two parties can strike a private, verifiable deal — and
          anyone can later confirm it was signed, without learning what was in it.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mt-12 w-full max-w-2xl">
        <h2 className="text-center font-display text-xl font-semibold tracking-tight text-ink-text sm:text-2xl">
          How it works
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <div key={step.n} className="rounded-xl border border-line-soft bg-ink-900/40 p-4">
              <p className="font-mono text-xs tracking-widest text-brass-bright">{step.n}</p>
              <p className="mt-2 text-sm font-medium text-ink-text">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
