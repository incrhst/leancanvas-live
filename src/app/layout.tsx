import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../index.css";
import { ConvexClientProvider } from "../components/ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeanCanvas Live — Realtime Collaborative Lean Canvas",
  description: "Realtime multiplayer Lean Canvas tool with AI stress-testing and evidence-based assumption tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-canvas text-ink antialiased`}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
