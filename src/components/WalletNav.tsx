"use client";

import { useEffect, useState } from "react";
import { connectWallet, disconnectWallet, getConnectedAddress } from "@/lib/wallet";
import { WaxSeal } from "./Seal";
import { truncateHash } from "./HashValue";
import { CheckIcon, CopyIcon } from "./icons";

// Wallet connection controls for the navbar: a Connect button when
// disconnected, and the address + Disconnect when connected. Reuses the
// existing wallet.ts connect/disconnect logic untouched.
export function WalletNav() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getConnectedAddress().then((addr) => {
      if (addr) setAddress(addr);
    });
  }, []);

  async function handleConnect() {
    setConnecting(true);
    const addr = await connectWallet();
    setAddress(addr);
    setConnecting(false);
    window.dispatchEvent(new Event("contractvault:wallet"));
  }

  function handleDisconnect() {
    disconnectWallet();
    setAddress(null);
    window.dispatchEvent(new Event("contractvault:wallet"));
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!address) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-paper px-4 py-2 text-sm font-medium text-paper-ink transition duration-150 hover:bg-paper-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-seal/30 bg-seal-dim/50 px-3 py-1.5">
      <WaxSeal state="signed" size={15} className="shrink-0" />
      <button
        type="button"
        onClick={copyAddress}
        aria-label="Copy wallet address"
        title="Copy wallet address"
        className="group flex items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-seal-bright"
      >
        <code className="font-mono text-xs text-seal-bright">
          {truncateHash(address, 12, 8)}
        </code>
        {copied ? (
          <CheckIcon className="text-seal-bright" />
        ) : (
          <CopyIcon className="text-ink-faint transition group-hover:text-ink-text" />
        )}
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        onClick={handleDisconnect}
        aria-label="Disconnect wallet"
        className="rounded text-xs text-ink-muted transition hover:text-ink-text focus-visible:outline-2 focus-visible:outline-seal-bright"
      >
        Disconnect
      </button>
    </div>
  );
}
