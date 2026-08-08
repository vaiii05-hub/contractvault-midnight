// src/app/my-agreements/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyAgreements, getMyPartyId } from "@/lib/api";
import { Agreement, AgreementStatus } from "@/lib/types";
import { WaxSeal } from "@/components/Seal";
import { ButtonLink } from "@/components/Buttons";
import { ChevronRightIcon } from "@/components/icons";

export default function MyAgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [myPartyId, setMyPartyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [list, myId] = await Promise.all([getMyAgreements(), getMyPartyId()]);
      setAgreements(list);
      setMyPartyId(myId);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-text">
            My agreements
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Agreements where you are Party A or Party B.
          </p>
        </div>
        <ButtonLink href="/new-agreement" variant="secondary">
          + New agreement
        </ButtonLink>
      </div>

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-line bg-ink-900/50 py-16 text-sm text-ink-muted">
          <span className="spinner" aria-hidden="true" />
          Opening the vault…
        </div>
      )}

      {!loading && agreements.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center">
          <WaxSeal state="pending" size={44} className="opacity-80" />
          <h2 className="mt-5 font-display text-xl font-semibold text-ink-text">
            Nothing sealed yet
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            When you create or sign an agreement, it will appear here — private,
            sealed, and provable on Midnight.
          </p>
          <ButtonLink href="/new-agreement" className="mt-6">
            Create your first agreement
          </ButtonLink>
        </div>
      )}

      {!loading && agreements.length > 0 && (
        <ul className="mt-8 space-y-3">
          {agreements.map((a) => {
            const signed = a.status === AgreementStatus.SIGNED;
            const role =
              a.partyA === myPartyId
                ? "Party A · creator"
                : a.partyBId === myPartyId
                  ? "Party B · signer"
                  : "Not a party";
            return (
              <li key={a.id}>
                <Link
                  href={`/agreement/${a.id}`}
                  className={`group flex items-center gap-4 rounded-xl border p-4 transition duration-150 hover:-translate-y-px hover:shadow-[0_16px_40px_-20px_rgb(0_0_0/0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal-bright ${
                    signed
                      ? "border-seal/25 bg-ink-900/60 hover:border-seal/40"
                      : "border-line bg-ink-900/50 hover:border-ink-600"
                  }`}
                >
                  <WaxSeal state={signed ? "signed" : "pending"} size={30} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-ink-text">
                      Agreement <span className="text-ink-faint">#</span>
                      {a.id}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{role}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-[11px] font-medium uppercase tracking-[0.14em] ${
                        signed ? "text-seal-bright" : "text-brass-bright"
                      }`}
                    >
                      {signed ? "Signed" : "Pending"}
                    </span>
                    <ChevronRightIcon className="text-ink-faint transition group-hover:text-ink-text" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
