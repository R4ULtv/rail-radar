import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import baseUrl from "@/lib/base-url";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: "Rail Radar | Live Train Tracker Across Europe",
    template: "%s | Rail Radar",
  },
  description:
    "Track live train departures, delays, platforms, and arrivals across 8,900+ stations in Italy, Switzerland, Finland, Belgium, the Netherlands, the UK, and Ireland.",
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "Rail Radar",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar - Live Train Tracking Map for Italy, Switzerland, Finland, Belgium, the Netherlands, the UK & Ireland",
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

export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark scroll-smooth scroll-pt-8"
      style={{ colorScheme: "dark" }}
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Preconnect to Mapbox services for faster map loading */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://events.mapbox.com" />
        <link rel="apple-touch-icon" href="/icon@180px.png" />
        <link rel="alternate" hrefLang="en" href="https://www.railradar24.com" />
        <link rel="alternate" hrefLang="x-default" href="https://www.railradar24.com" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NuqsAdapter>{children}</NuqsAdapter>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
