import Link from "next/link";
import type { LinkProps } from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal-bright disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Paper — the crisp "stamp" primary action.
  primary:
    "bg-paper text-paper-ink hover:bg-paper-deep hover:-translate-y-px active:translate-y-0 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]",
  secondary:
    "border border-line bg-ink-850 text-ink-text hover:border-ink-600 hover:bg-ink-800 hover:-translate-y-px active:translate-y-0",
  ghost: "text-ink-muted hover:bg-ink-800 hover:text-ink-text",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: Omit<LinkProps, "className"> & { variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
