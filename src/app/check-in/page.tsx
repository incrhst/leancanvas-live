"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeftIcon, CheckCircle2Icon, ClipboardCheckIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../components/ConvexClientProvider";
import { CheckInCard } from "../../components/CheckIn";

/**
 * The weekly check-in: for each note you own, any new evidence this week? Built for a phone.
 * The Monday email links here.
 */
export default function CheckInPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pending = useQuery(api.checkIns.myPending, user ? {} : "skip");
  const [done, setDone] = useState<{ text: string; hasEvidence: boolean }[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?redirect=/check-in");
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <h1 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <ClipboardCheckIcon size={16} aria-hidden="true" />
          Weekly check-in
        </h1>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {done.map((d, i) => (
          <p
            key={i}
            className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>{d.hasEvidence ? "Saved as the latest result" : "No new evidence"}:</strong> {d.text}
            </span>
          </p>
        ))}

        {pending === undefined ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            Nothing to check in on. You're up to date.
          </p>
        ) : (
          pending.map((item) => (
            <CheckInCard
              key={item.noteId}
              item={item}
              onAnswered={(hasEvidence) => setDone((prev) => [...prev, { text: item.text, hasEvidence }])}
            />
          ))
        )}
      </main>
    </div>
  );
}
