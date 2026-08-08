"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WaxSeal } from "./Seal";
import { WalletNav } from "./WalletNav";

const links = [
  { href: "/", label: "Vault" },
  { href: "/new-agreement", label: "New agreement" },
  { href: "/my-agreements", label: "My agreements" },
];

export function VaultHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/70 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <Link
          href="/"
          aria-label="ContractVault — home"
          className="flex shrink-0 items-center gap-2.5 self-start rounded-md focus-visible:outline-2 focus-visible:outline-seal-bright"
        >
          <WaxSeal state="pending" size={24} />
          <span className="font-display text-lg font-semibold tracking-tight text-ink-text">
            ContractVault
          </span>
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <nav className="-mx-2 flex items-center gap-0.5 overflow-x-auto sm:mx-0">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-seal-bright ${
                    active
                      ? "bg-ink-800 text-ink-text"
                      : "text-ink-muted hover:bg-ink-850 hover:text-ink-text"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <WalletNav />
        </div>
      </div>
    </header>
  );
}
