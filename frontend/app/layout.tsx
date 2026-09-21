import type { Metadata, Viewport } from "next";
import { Martian_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-head",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fair Draw",
  description: "A verifiable commit-then-reveal raffle on GenLayer - no LLM, validators reach consensus on a public drand randomness beacon.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#060810",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${martianMono.variable} ${ibmPlexMono.variable}`} data-scroll-behavior="smooth">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
