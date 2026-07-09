import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://watchtower.xyz";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WatchTower | Threat Intelligence for Autonomous Trading Agents",
    template: "%s | WatchTower",
  },
  description: "Agent-first threat intelligence middleware for scanning EVM tokens before autonomous trading agents execute.",
  applicationName: "WatchTower",
  keywords: [
    "WatchTower",
    "AI trading agents",
    "threat intelligence",
    "x402",
    "MCP",
    "X Layer",
    "token security",
  ],
  openGraph: {
    title: "WatchTower",
    description: "Threat intelligence middleware for autonomous AI trading agents.",
    url: siteUrl,
    siteName: "WatchTower",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WatchTower",
    description: "Threat intelligence middleware for autonomous AI trading agents.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-slate-950 text-slate-50">{children}</body>
    </html>
  );
}
