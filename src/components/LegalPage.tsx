import React from "react";
import Link from "next/link";

export const LEGAL_CONTACT_EMAIL = "privacy@criticaldash.com";

/** Shared frame for the privacy policy and terms: the site's nav, a readable column, the footer. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-incrementic-red selection:text-white">
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md px-5 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-incrementic-ink">CriticalDash</span>
              <span className="hidden md:inline text-sm text-muted">by Incrementic</span>
            </div>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center whitespace-nowrap text-base font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-5 sm:px-6 py-12 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-incrementic-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
          <div className="mt-10 space-y-10 text-base leading-relaxed text-incrementic-charcoal">{children}</div>
        </article>
      </main>

      <footer className="border-t border-line bg-surface px-6 py-10 text-center text-base text-muted space-y-3">
        <div className="font-semibold text-ink">CriticalDash • One record of every decision, for businesses between providers and customers</div>
        <LegalLinks />
        <div className="flex flex-wrap items-center justify-center gap-x-1.5">
          <span>A project of</span>
          <a
            href="https://incrementic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-incrementic-red hover:underline transition-colors"
          >
            Incrementic
          </a>
          <span>— The shortest distance to your next big thing.</span>
        </div>
      </footer>
    </div>
  );
}

/** The home, how-it-works, privacy and terms links that sit in every footer. */
export function LegalLinks() {
  const link = "font-semibold text-ink underline underline-offset-2 hover:text-incrementic-red";
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <Link href="/" className={link}>Home</Link>
      <Link href="/how-it-works" className={link}>How it works</Link>
      <Link href="/privacy" className={link}>Privacy</Link>
      <Link href="/terms" className={link}>Terms</Link>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-incrementic-ink">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-muted">{children}</ul>;
}

export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-incrementic-red underline underline-offset-2">
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
