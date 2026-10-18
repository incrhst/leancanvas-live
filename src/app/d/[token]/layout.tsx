import type { Metadata } from "next";

// The token in the URL answers a decision, so keep these pages out of search and referrers
export const metadata: Metadata = {
  title: "Your decision · LeanCanvas Live",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DecisionLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
