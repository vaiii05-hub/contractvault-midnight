// src/app/agreement/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAgreementById, getMyPartyId, signAgreement } from "@/lib/api";
import { canSign } from "@/lib/buildSignAgreement";
import { Agreement, AgreementStatus } from "@/lib/types";
import { StatusPill } from "@/components/Seal";
import { HashValue } from "@/components/HashValue";
import { Button, ButtonLink } from "@/components/Buttons";
import { AlertIcon, ArrowLeftIcon, LockIcon } from "@/components/icons";

export default function AgreementDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [terms, setTerms] = useState<string | null>(null);
  const [myPartyId, setMyPartyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [found, myId] = await Promise.all([getAgreementById(id), getMyPartyId()]);
      setAgreement(found);
      setMyPartyId(myId);

      if (found) {
        const myRole = found.partyA === myId || found.partyBId === myId;
        // Only expose the real terms text if you're actually Party A or Party B
        if (myRole) {
          setTerms(found.terms);
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSign() {
    if (!agreement) return;
    setError(null);
    setSigning(true);
    try {
      const updated = await signAgreement(agreement);
      setAgreement(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 pb-10 pt-24 text-sm text-ink-muted">
        <span className="spinner" aria-hidden="true" />
        Opening the vault…
      </main>
    );
  }

  if (!agreement) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-10 sm:pt-14">
        <div className="flex flex-col items-center rounded-2xl border border-line bg-ink-900/50 px-6 py-16 text-center">
          <p className="font-mono text-xs tracking-widest text-ink-faint">AGREEMENT · {id}</p>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-text">
            Not found
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            This agreement doesn&apos;t exist in your vault — or you&apos;re not
            party to it.
          </p>
          <ButtonLink href="/my-agreements" variant="secondary" className="mt-6">
            Back to My Agreements
          </ButtonLink>
        </div>
      </main>
    );
  }

  const isPartyA = agreement.partyA === myPartyId;
  const isPartyB = agreement.partyBId === myPartyId;
  const showSignButton = myPartyId ? canSign(agreement, myPartyId) : false;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:pt-14">
      <Link
        href="/my-agreements"
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-ink-muted transition hover:text-ink-text focus-visible:outline-2 focus-visible:outline-seal-bright"
      >
        <ArrowLeftIcon />
        My agreements
      </Link>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-ink-900/70 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.6)] backdrop-blur">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-text">
            Agreement <span className="font-mono text-base text-ink-muted">#{id}</span>
          </h1>
          <StatusPill status={agreement.status} />
        </div>

        {/* Meta */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-ink-muted">
            Your role:{" "}
            <span className="font-medium text-ink-text">
              {isPartyA ? "Party A (creator)" : isPartyB ? "Party B (signer)" : "Not a party to this agreement"}
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-ink-850 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Party A
              </p>
              <HashValue value={agreement.partyA} className="mt-1.5" />
            </div>
            <div className="rounded-lg border border-line bg-ink-850 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Party B
              </p>
              <HashValue value={agreement.partyBId} className="mt-1.5" />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-ink-850 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Terms fingerprint
            </p>
            <HashValue value={agreement.termsFingerprint} className="mt-1.5" />
          </div>
        </div>

        {/* Document */}
        <div className="border-t border-line-soft px-6 py-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Terms
          </p>
          {terms !== null ? (
            <div className="paper-surface relative rounded-lg p-5 text-sm leading-relaxed">
              {terms}
              {agreement.status === AgreementStatus.SIGNED && (
                <span className="seal-stamp absolute right-4 top-4">Sealed</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-4 py-4 text-sm text-ink-muted">
              <LockIcon className="shrink-0" />
              You&apos;re not authorized to view these terms.
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-4 flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-dim/60 px-4 py-3 text-sm text-danger-bright">
            <AlertIcon className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="px-6 pb-6">
          {showSignButton && (
            <Button onClick={handleSign} disabled={signing} className="w-full">
              {signing ? "Sealing…" : "Sign & seal this agreement"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
