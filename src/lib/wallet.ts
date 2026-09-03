// src/lib/wallet.ts
// Connects to a Midnight DApp Connector wallet (e.g. Lace) using the
// official @midnight-ntwrk/dapp-connector-api types, and manages the
// local secret key used as this app's witness identity.
//
// NOTE: per Midnight's official docs, wallets inject their API under
// window.midnight keyed by a freshly generated UUID (not a fixed name
// like "lace" or "mnLace"), so we enumerate window.midnight and pick
// the first available wallet, rather than hardcoding a key.

import type { InitialAPI, ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

const SECRET_KEY_STORAGE_KEY = "contractvault_secret_key";
const NETWORK_ID = "preview";

function getAvailableWallet(): InitialAPI | null {
  if (typeof window === "undefined") return null;
  if (!window.midnight) return null;

  const entries = Object.entries(window.midnight).filter(
    ([, w]) => !!w && typeof w === "object" && "apiVersion" in w
  ) as [string, InitialAPI][];

  // Prefer Lace: it's injected under a generated UUID key rather than a
  // fixed name (per Midnight's official docs), so anything NOT keyed "1am"
  // is treated as Lace/other-compatible-wallet and preferred over 1AM.
    // Prefer 1AM specifically: it reliably sponsors/generates DUST on
  // Preview, whereas other wallets have shown intermittent DUST issues.
  const preferred = entries.find(([key]) => key === "1am");
  if (preferred) return preferred[1];

  return entries[0]?.[1] ?? null;
}

let walletConnectPromise: Promise<ConnectedAPI | null> | null = null;
let connectedApi: ConnectedAPI | null = null;

async function connectMidnightWallet(): Promise<ConnectedAPI | null> {
  const wallet = getAvailableWallet();
  if (!wallet) {
    console.warn(`No Midnight wallet found. window.midnight =`, window.midnight);
    return null;
  }

    try {
    console.log("[DEBUG] Attempting wallet.connect with:", NETWORK_ID);
    const result = await wallet.connect(NETWORK_ID);
    console.log("[DEBUG] wallet.connect SUCCESS:", result);
    return result;
  } catch (err) {
    console.error(`wallet.connect("${NETWORK_ID}") failed:`, err);
    console.error("[DEBUG] Error keys:", Object.keys(err as object));
    console.error("[DEBUG] Error JSON:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    return null;
  }
}

function ensureConnected(): Promise<ConnectedAPI | null> {
  if (connectedApi) return Promise.resolve(connectedApi);

  if (!walletConnectPromise) {
    walletConnectPromise = connectMidnightWallet().finally(() => {
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

let cachedAddress: string | null | undefined = undefined;
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

export async function getConnectedAPI(): Promise<ConnectedAPI | null> {
  const api = await ensureConnected();
  if (api) connectedApi = api;
  return api;
}

export async function connectWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const api = await ensureConnected();
  if (!api) {
    cachedAddress = null;
    alert("No Midnight wallet found or connection failed. Please install/enable Lace and try again.");
    return null;
  }

  connectedApi = api;
  const address = await getAddress(api);
  cachedAddress = address;
  return address;
}

export function disconnectWallet(): void {
  cachedAddress = null;
  connectedApi = null;
  walletConnectPromise = null;
  addressPromise = null;
}

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

export function getLocalSecretKeyBytes(): Uint8Array {
  const hex = getOrCreateLocalSecretKey();
  return hexToBytes(hex);
}