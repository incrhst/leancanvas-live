import type { Metadata } from "next";

// The token in the URL sends results to a note, so keep these pages out of search and referrers
export const metadata: Metadata = {
  title: "Send a result · LeanOn",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResultLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
