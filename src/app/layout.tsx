import type { Metadata } from "next";
import { Inter, Sora, IBM_Plex_Mono } from "next/font/google";
import "../index.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "../components/ConvexClientProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lean.incrementic.com"),
  title: "CriticalDash — Decisions and runbooks for businesses between providers and customers, by Incrementic",
  description:
    "Which providers to list, how to rank their plans, what to do when a partner changes its rates. CriticalDash checks what works and turns it into runbooks your team can follow.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/icon.svg" },
    ],
  },
  alternates: {
    canonical: "https://lean.incrementic.com",
  },
  openGraph: {
    title: "CriticalDash — by Incrementic",
    description: "You built the business. Would it run without you? For brokers, comparison sites and agencies: see which provider, pricing and customer decisions are still guesses, and which run as written runbooks.",
    url: "https://lean.incrementic.com",
    siteName: "CriticalDash",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "CriticalDash by Incrementic",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CriticalDash — by Incrementic",
    description: "You built the business. Would it run without you? For brokers, comparison sites and agencies: see which provider, pricing and customer decisions are still guesses, and which run as written runbooks.",
    images: ["/og.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${inter.variable} ${sora.variable} ${ibmPlexMono.variable}`}>
        <body className="font-sans bg-canvas text-ink antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
