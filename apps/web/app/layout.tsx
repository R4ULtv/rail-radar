import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

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
    default: "Rail Radar - Live Train Tracker for Italy",
    template: "%s | Rail Radar",
  },
  description:
    "Track Italian trains in real time. Get live delays, platform numbers, and departure info for all 2400+ train stations across Italy.",
  openGraph: {
    type: "website",
    url: "https://www.railradar24.com",
    siteName: "Rail Radar",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar - Live Italian Train Tracking Map",
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
