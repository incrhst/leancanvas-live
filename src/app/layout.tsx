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
  title: "CriticalDash — Take the risk out of how your business runs, by Incrementic",
  description:
    "Your business is one resignation away from forgetting how it works. CriticalDash shows which parts are still guesses and which are proven, and turns each into a written runbook.",
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
    description: "Your business is one resignation away from forgetting how it works. See what's still a guess, what's proven, and what lives in one person's head.",
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
    description: "Your business is one resignation away from forgetting how it works. See what's still a guess, what's proven, and what lives in one person's head.",
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
