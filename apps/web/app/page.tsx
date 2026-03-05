import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Map } from "@/components/map";
import MapLoading from "@/components/map-loading";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Rail Radar",
  url: "https://www.railradar24.com",
  description:
    "Track trains in real time across Italy, Switzerland, and Finland. Get live delays, platform numbers, and departure info for over 4500 train stations.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.railradar24.com/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <main className="h-svh w-svw">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <h1 className="sr-only">Rail Radar - Live Train Tracker for Italy, Switzerland & Finland</h1>
      <div className="sr-only">
        <p>
          Rail Radar is a real-time train tracking application covering Italy, Switzerland, and
          Finland. Monitor live departures, arrivals, delays, and platform changes across more than
          4500 train stations on an interactive map. Stay informed with up-to-date data from RFI,
          Swiss public transport feeds, and Finnish Digitraffic, whether you are commuting daily or
          planning a trip across Europe.
        </p>
        <p>
          Search any station to see upcoming trains, check real-time delay information, and explore
          trending stations. Rail Radar supports major operators including Trenitalia, Italo,
          Trenord, SBB, VR, and many regional services. Bookmark your favorite stations for quick
          access and share live views with friends using shareable map links.
        </p>
      </div>
      <Suspense fallback={<MapLoading />}>
        <Map />
        <div className="absolute bottom-2 left-3 flex flex-wrap max-w-60 md:max-w-full gap-x-1 text-[10px] text-foreground/60">
          <span>
            <a
              href="https://www.mapbox.com/about/maps/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              © Mapbox
            </a>
            ,{" "}
            <a
              href="http://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              © OpenStreetMap
            </a>
            ,{" "}
            <a
              href="https://www.mapbox.com/map-feedback/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Improve this map
            </a>
            <span className="hidden md:inline">{" ·"}</span>
          </span>
          <span>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms-of-service" className="hover:underline">
              Terms
            </Link>
            {" · "}
            <a href="mailto:contact@railradar24.com" className="hover:underline">
              Contact
            </a>
          </span>
        </div>
      </Suspense>
    </main>
  );
}
