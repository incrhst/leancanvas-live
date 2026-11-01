import type { Metadata } from "next";
import HowItWorks from "./HowItWorks";

export const metadata: Metadata = {
  title: "How it works — CriticalDash by Incrementic",
  description:
    "Seven steps from a hunch to something that runs without you, for businesses between providers and customers: put it on one page, find the riskiest guesses, test against a pass mark agreed first, decide on the record, look back, and write what works up as a runbook.",
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
