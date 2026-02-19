import type { Metadata } from "next";
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
    "Track trains in real time across Italy and Switzerland. Get live delays, platform numbers, and departure info for over 4500 train stations.",
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
      <Suspense fallback={<MapLoading />}>
        <Map />
        <div className="absolute bottom-2 left-3 text-[10px] text-white/60">
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
            className="font-semibold hover:underline"
          >
            Improve this map
          </a>
        </div>
      </Suspense>
    </main>
  );
}
