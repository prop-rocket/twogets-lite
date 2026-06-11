import type { Metadata } from "next";
import { Advent_Pro } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { siteUrl } from "@/lib/utils";

import "./globals.css";

const adventPro = Advent_Pro({
  subsets: ["latin"],
  variable: "--font-advent-pro",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${APP_NAME} — Verified Home Rentals, Instantly`,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_TAGLINE} TwoGets connects verified homeowners directly with verified tenants — no brokers, no surprises.`,
  keywords: ["rental", "house for rent", "verified tenants", "verified owners", "no broker", "TwoGets"],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Verified Home Rentals, Instantly`,
    description: APP_TAGLINE,
    images: [{ url: "/brand/og-icon.png", width: 512, height: 504, alt: "TwoGets" }],
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME} — Verified Home Rentals, Instantly`,
    description: APP_TAGLINE,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${adventPro.variable} font-sans`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
