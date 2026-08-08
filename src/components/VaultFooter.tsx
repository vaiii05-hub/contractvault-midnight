import Link from "next/link";
import { WaxSeal } from "./Seal";

const footerLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Midnight Network", href: "#" },
  { label: "GitHub", href: "#" },
];

export function VaultFooter() {
  return (
    <footer className="border-t border-line-soft/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          aria-label="ContractVault — home"
          className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-seal-bright"
        >
          <WaxSeal state="pending" size={16} />
          <span className="font-display text-base font-semibold tracking-tight text-ink-text">
            ContractVault
          </span>
        </Link>

        <nav aria-label="Footer" className="flex items-center gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md text-sm text-ink-muted transition hover:text-ink-text focus-visible:outline-2 focus-visible:outline-seal-bright"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
