// src/app/new-agreement/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAgreement } from "@/lib/api";
import { Button } from "@/components/Buttons";
import { AlertIcon, ArrowLeftIcon } from "@/components/icons";

export default function NewAgreementPage() {
  const [partyBId, setPartyBId] = useState("");
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const agreement = await createAgreement({ partyBId, terms });
      router.push(`/agreement/${agreement.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-10 pt-10 sm:pt-14">
      <Link
        href="/my-agreements"
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-ink-muted transition hover:text-ink-text focus-visible:outline-2 focus-visible:outline-seal-bright"
      >
        <ArrowLeftIcon />
        My agreements
      </Link>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-text">
          Draft an agreement
        </h1>
        <p className="mt-2 max-w-md text-sm text-ink-muted">
          The terms stay private between you and Party B. Only the fact that it
          was signed is ever public.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-ink-900/70 p-6 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.6)] backdrop-blur sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="partyBId"
              className="mb-1.5 block text-sm font-medium text-ink-text"
            >
              Party B&apos;s Agreement ID
            </label>
            <input
              id="partyBId"
              type="text"
              value={partyBId}
              onChange={(e) => setPartyBId(e.target.value)}
              placeholder="Paste the 64-character code Party B shared"
              required
              className="w-full rounded-lg border border-line bg-ink-850 px-4 py-3 font-mono text-sm text-ink-text placeholder:text-ink-faint transition focus:border-seal/60 focus:outline-none focus:ring-2 focus:ring-seal/25"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Party B generates this from their own vault — paste it exactly as
              shared.
            </p>
          </div>

          <div>
            <label
              htmlFor="terms"
              className="mb-1.5 block text-sm font-medium text-ink-text"
            >
              Agreement terms
            </label>
            <textarea
              id="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Write the full agreement text here…"
              required
              rows={8}
              className="w-full rounded-lg border border-line bg-ink-850 px-4 py-3 text-sm leading-relaxed text-ink-text placeholder:text-ink-faint transition focus:border-seal/60 focus:outline-none focus:ring-2 focus:ring-seal/25"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Only a fingerprint of this text is recorded on-chain. The content
              stays between you and Party B.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-dim/60 px-4 py-3 text-sm text-danger-bright">
              <AlertIcon className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating…" : "Create Agreement"}
          </Button>
        </form>
      </div>
    </main>
  );
}
