"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

// Shortens long hex IDs for display (e.g. a1b2c3d4…e5f6a7b8).
export function truncateHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

// Displays a mono, truncated hash with a copy button. The full value is
// available via the title tooltip and clipboard.
export function HashValue({
  value,
  className = "",
  copyable = true,
}: {
  value: string;
  className?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}>
      <code
        title={value}
        className="block min-w-0 truncate font-mono text-xs leading-relaxed text-ink-muted"
      >
        {truncateHash(value)}
      </code>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="shrink-0 rounded p-1 text-ink-faint transition hover:bg-ink-700 hover:text-ink-text focus-visible:outline-2 focus-visible:outline-seal-bright"
        >
          {copied ? <CheckIcon className="text-seal-bright" /> : <CopyIcon />}
        </button>
      )}
    </span>
  );
}
