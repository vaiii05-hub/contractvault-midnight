// src/lib/wallet.ts
// Connects to the 1AM wallet (a Midnight DApp Connector implementation)
// using the official @midnight-ntwrk/dapp-connector-api types, and manages
// the local secret key used as this app's witness identity.

import type { InitialAPI, ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

const SECRET_KEY_STORAGE_KEY = "contractvault_secret_key";
const WALLET_ID = "1am";
const NETWORK_ID = "preview";

function get1AMWallet(): InitialAPI | null {
  if (typeof window === "undefined") return null;
  return window.midnight?.[WALLET_ID] ?? null;
}

// 1AM rejects concurrent connect() calls with "Connection request already
// pending", and React Strict Mode double-fires effects in development.
// We therefore keep a single in-flight connect promise (reused by any
// concurrent caller) and cache the connected API so we never re-connect.
let walletConnectPromise: Promise<ConnectedAPI | null> | null = null;
let connectedApi: ConnectedAPI | null = null;

async function connect1AM(): Promise<ConnectedAPI | null> {
  const wallet = get1AMWallet();
  if (!wallet) {
    console.warn(`1AM wallet not found. window.midnight =`, window.midnight);
    return null;
  }

  try {
    return await wallet.connect(NETWORK_ID);
  } catch (err) {
    console.error(`wallet.connect("${NETWORK_ID}") failed:`, err);
    return null;
  }
}

function ensureConnected(): Promise<ConnectedAPI | null> {
  if (connectedApi) return Promise.resolve(connectedApi);

  if (!walletConnectPromise) {
    walletConnectPromise = connect1AM().finally(() => {
      walletConnectPromise = null;
    });
  }
  return walletConnectPromise;
}

async function getAddress(api: ConnectedAPI): Promise<string | null> {
  try {
    const { unshieldedAddress } = await api.getUnshieldedAddress();
    return unshieldedAddress;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to read unshielded address:", message);

    // The wallet is syncing its local state and is rate-limiting us.
    // Retry exactly once after a real delay instead of hammering it.
    if (/syncing/i.test(message)) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const { unshieldedAddress } = await api.getUnshieldedAddress();
        return unshieldedAddress;
      } catch (retryErr) {
        console.error("Unshielded address retry failed:", retryErr);
        alert("Wallet is still syncing, please wait a moment and try again");
        return null;
      }
    }

    return null;
  }
}

// ---------- Wallet connection ----------

// getUnshieldedAddress() is rate-limited by the wallet while it syncs, so
// resolve the address at most once per page load and reuse the result.
// cachedAddress is tri-state:
//   undefined — not resolved this session (only true on a fresh page load)
//   null      — resolved to "not connected" (wallet absent or fetch failed)
//   string    — resolved connected address
// After the first resolution, later calls return the cached value without
// touching the wallet. The wallet is only re-contacted again on an explicit
// Connect click (connectWallet) or a full page reload (module re-evaluates).
// Concurrent callers (e.g. React Strict Mode double-firing the home page
// effect) share the same in-flight promise instead of firing duplicates.
let cachedAddress: string | null | undefined = undefined; // undefined = not resolved yet
let addressPromise: Promise<string | null> | null = null;

async function fetchAddress(): Promise<string | null> {
  const api = await ensureConnected();
  if (!api) {
    cachedAddress = null;
    return null;
  }

  connectedApi = api;
  const address = await getAddress(api);
  cachedAddress = address;
  return address;
}

export function getConnectedAddress(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (cachedAddress !== undefined) return Promise.resolve(cachedAddress);

  if (!addressPromise) {
    addressPromise = fetchAddress().finally(() => {
      addressPromise = null;
    });
  }
  return addressPromise;
}

// Returns the live ConnectedAPI from the 1AM wallet, reusing the same cached
// connection as the address helpers. Contract calls need it for proving,
// balancing, and submission (see src/lib/contract.ts).
export async function getConnectedAPI(): Promise<ConnectedAPI | null> {
  const api = await ensureConnected();
  if (api) connectedApi = api;
  return api;
}

// Explicit user action (Connect button click): always re-contact the wallet
// for a fresh address, bypassing the cached value, and cache the result so
// subsequent navigations don't hit the wallet again.
export async function connectWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const api = await ensureConnected();
  if (!api) {
    cachedAddress = null;
    alert("1AM wallet not found or connection failed. Please install/enable it and try again.");
    return null;
  }

  connectedApi = api;
  const address = await getAddress(api);
  cachedAddress = address;
  return address;
}

// Ends the local session: drops the cached connection and marks the address
// as resolved-to-disconnected (null, not undefined) so the next page
// navigation shows the disconnected state without re-contacting the wallet.
// (The wallet's own connection is managed by the 1AM extension; this resets
// the DApp's view of it. Reconnecting requires an explicit Connect click.)
export function disconnectWallet(): void {
  cachedAddress = null;
  connectedApi = null;
  walletConnectPromise = null;
  addressPromise = null;
}

// ---------- Local secret key (the `mySecretKey` witness) ----------
// This is NOT the 1AM-wallet address. It's a per-browser secret that
// identifies "you" inside the contract (partyA / partyBId are derived from
// this, via the contract's own publicKey circuit — not computed here).

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

// Returns the 32-byte secret as a hex string, creating one on first use.
export function getOrCreateLocalSecretKey(): string {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateLocalSecretKey must run in the browser");
  }

  const existing = localStorage.getItem(SECRET_KEY_STORAGE_KEY);
  if (existing) return existing;

  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const hex = bytesToHex(randomBytes);

  localStorage.setItem(SECRET_KEY_STORAGE_KEY, hex);
  return hex;
}

// Returns the secret as raw bytes.
export function getLocalSecretKeyBytes(): Uint8Array {
  const hex = getOrCreateLocalSecretKey();
  return hexToBytes(hex);
}
