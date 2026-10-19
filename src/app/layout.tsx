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
  title: "LeanOn — Plans that keep moving between meetings, by Incrementic",
  description:
    "Lean and go-to-market canvases where the person who decides answers one question from their phone, with no login, and sees what happens if they don't.",
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
    title: "LeanOn — by Incrementic",
    description: "Plans don't fail in meetings. They stall between them. LeanOn sends the decider one question, with what happens if they don't answer.",
    url: "https://lean.incrementic.com",
    siteName: "LeanOn",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "LeanOn by Incrementic",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeanOn — by Incrementic",
    description: "Plans don't fail in meetings. They stall between them. LeanOn sends the decider one question, with what happens if they don't answer.",
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
