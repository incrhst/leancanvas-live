import type { Metadata } from "next";
import BrandGuide from "./BrandGuide";

export const metadata: Metadata = {
  title: "Brand guide — CriticalDash by Incrementic",
  description:
    "How CriticalDash looks, moves and talks: colour, type, the street and sky, fog, motion, components and voice, taken from the landing page.",
  robots: { index: false },
};

export default function BrandPage() {
  return <BrandGuide />;
}
