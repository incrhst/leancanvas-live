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
  title: "CriticalDash — One record of every decision, for businesses between providers and customers, by Incrementic",
  description:
    "Campaigns change direction, policies change, new regulations land. CriticalDash is the record of every decision: what's decided, what's open and who's deciding, so everyone is aligned and you move forward with confidence.",
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
    description: "You built the business. Would it run without you? One record of every decision, so the whole team is aligned on what's decided, what's open and who's deciding.",
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
    description: "You built the business. Would it run without you? One record of every decision, so the whole team is aligned on what's decided, what's open and who's deciding.",
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
