import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { LookUpSkyline } from "../components/LookUpSkyline";
import { NotFoundSky } from "../components/NotFoundSky";

export const metadata: Metadata = {
  title: "Page not found — CriticalDash by Incrementic",
  robots: { index: false },
};

// Looking up the same street the landing page opens on, at the spot where the page should be.
export default function NotFound() {
  return (
    <div className="min-h-[100svh] flex flex-col overflow-x-clip bg-[#0F3A33] text-white selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="relative z-20 border-b border-line bg-surface/95 backdrop-blur-md px-5 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-incrementic-ink">
                CriticalDash
              </span>
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

      <main className="relative flex-1 flex items-center justify-center overflow-hidden px-5 sm:px-6 py-8 sm:py-10">
        <LookUpSkyline className="hidden lg:block absolute inset-0" zoom={1.1} />
        {/* On phones the street is drawn tall, so there's sky above and below the panel */}
        <LookUpSkyline
          className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[2700px]"
          aspect={1 / 3}
          sky={{ rx: 384, ry: 470 }}
        />

        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-5 sm:gap-6">
          <NotFoundSky className="w-full max-w-[20rem] sm:max-w-sm" />

          <div className="w-full rounded-3xl border border-[#9FE0C2]/40 bg-[#0A2622]/85 backdrop-blur-md p-6 sm:p-8 space-y-5 shadow-2xl">
            <p className="text-lg font-semibold text-white/95">404: page not found</p>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight leading-[1.05]">
              This page has blown away.
            </h1>
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
              You&rsquo;re on the right street, but the page you wanted isn&rsquo;t up there. The link may be old, or
              it may have a typo. We looked in the fog. Nothing there either.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                href="/"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#C8352D] px-7 font-display font-semibold text-lg text-white shadow-xl hover:bg-[#B32E27] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE0C2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2622]"
              >
                <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                Back to the start
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border-2 border-white/80 bg-[#0A2622]/60 px-7 font-display font-semibold text-lg text-white hover:bg-[#0A2622]/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE0C2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2622]"
              >
                See how it works
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
