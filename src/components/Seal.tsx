import { AgreementStatus } from "@/lib/types";

export type SealState = "signed" | "pending";

// The recurring motif: a wax seal. Filled with the seal-green accent when
// signed, a dashed brass ring while pending.
export function WaxSeal({
  state,
  size = 22,
  className = "",
}: {
  state: SealState;
  size?: number;
  className?: string;
}) {
  const stroke = state === "signed" ? "var(--seal)" : "var(--brass)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {state === "signed" ? (
        <>
          <circle cx="12" cy="12" r="11" fill="var(--seal)" opacity="0.16" />
          <circle cx="12" cy="12" r="9" fill="var(--seal)" />
          <circle cx="12" cy="12" r="6.4" stroke="var(--ink-950)" strokeWidth="1" opacity="0.5" fill="none" />
          <path
            d="M8.6 12.4l2.2 2.2 4.6-5"
            stroke="var(--ink-950)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.4" strokeDasharray="3.5 2.6" />
          <circle cx="12" cy="12" r="5.4" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.7" />
          <circle cx="12" cy="12" r="1.4" fill={stroke} />
        </>
      )}
    </svg>
  );
}

export function StatusPill({
  status,
  className = "",
}: {
  status: AgreementStatus;
  className?: string;
}) {
  const signed = status === AgreementStatus.SIGNED;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${
        signed
          ? "border-seal/40 bg-seal-dim/60 text-seal-bright"
          : "border-brass/40 bg-brass-dim/60 text-brass-bright"
      } ${className}`}
    >
      <WaxSeal state={signed ? "signed" : "pending"} size={14} />
      {signed ? "Signed" : "Pending"}
    </span>
  );
}
