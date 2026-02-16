import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerCleanup } from "@/components/ServiceWorkerCleanup";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.railradar24.com"),
  title: {
    default: "Rail Radar - Live Train Tracker for Italy & Switzerland",
    template: "%s | Rail Radar",
  },
  description:
    "Track trains in real time across Italy and Switzerland. Get live delays, platform numbers, and departure info for over 4500 train stations.",
  openGraph: {
    type: "website",
    url: "https://www.railradar24.com",
    siteName: "Rail Radar",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar - Live Train Tracking Map for Italy & Switzerland",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  category: "travel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rail Radar",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        {/* Preconnect to Mapbox services for faster map loading */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://events.mapbox.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
        {process.env.VERCEL_TARGET_ENV === "production" && (
          <ServiceWorkerCleanup />
        )}
        <Analytics />
      </body>
    </html>
  );
}
