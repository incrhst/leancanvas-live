import type { Metadata } from "next";
import { Inter, Sora, IBM_Plex_Mono } from "next/font/google";
import "../index.css";
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
  title: "LeanCanvas Live — Realtime Collaborative Lean Canvas by Incrementic",
  description:
    "Realtime multiplayer Lean Canvas tool with AI stress-testing and evidence-based assumption tracking. The shortest distance to your next validated business.",
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
    title: "LeanCanvas Live — by Incrementic",
    description: "The shortest distance to your next validated business. Realtime multiplayer Lean Canvas with automated AI stress testing.",
    url: "https://lean.incrementic.com",
    siteName: "LeanCanvas Live",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "LeanCanvas Live by Incrementic",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeanCanvas Live — by Incrementic",
    description: "The shortest distance to your next validated business. Realtime multiplayer Lean Canvas with automated AI stress testing.",
    images: ["/og.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${ibmPlexMono.variable}`}>
      <body className="font-sans bg-canvas text-ink antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
