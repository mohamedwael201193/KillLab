import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "KillLab — Don't let a convincing backtest fool you.",
  description:
    "KillLab is an AI Trading Desk for Review & Self-Evolution. Write a trading hypothesis, freeze the test, and let a deterministic research engine try to kill it with walk-forward testing, bootstrap confidence, Deflated Sharpe and nine known traps.",
  keywords: [
    "KillLab",
    "trading research",
    "walk-forward testing",
    "Deflated Sharpe Ratio",
    "backtest overfitting",
    "research process",
  ],
  openGraph: {
    title: "KillLab — Don't let a convincing backtest fool you.",
    description:
      "Write the hypothesis. Freeze the test. Let the engine try to kill the idea before the market does.",
    siteName: "KillLab",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
