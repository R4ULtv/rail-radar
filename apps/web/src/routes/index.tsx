import { createFileRoute, Link } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { Suspense } from "react";
import { preconnect } from "react-dom";

import { Map } from "@/components/map";
import MapLoading from "@/components/map-loading";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";

type MapSearch = {
  lat?: number;
  lng?: number;
  zoom?: number;
  station?: string;
  q?: string;
};

function numberSearch(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringSearch(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (search): MapSearch => ({
    lat: numberSearch(search.lat),
    lng: numberSearch(search.lng),
    zoom: numberSearch(search.zoom),
    station: stringSearch(search.station),
    q: stringSearch(search.q),
  }),
  head: () => metadataToHead(metadata),
  component: Home,
});

const metadata: Metadata = {
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
    "Explore more than 26,000 stations and stops in 16 European countries, including the Czech Republic. View live railway boards where available.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.railradar24.com/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

function Home() {
  preconnect("https://api.mapbox.com", { crossOrigin: "anonymous" });

  return (
    <main className="h-svh w-svw">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <h1 className="sr-only">
        Rail Radar - Live Train Tracker for Italy, Switzerland, Germany, Finland, Belgium, Denmark,
        the Netherlands, Norway, Sweden, Poland, the UK, Ireland, France, Luxembourg, Hungary, and
        the Czech Republic
      </h1>
      <div className="sr-only">
        <p>
          Rail Radar is a real-time train tracking application covering Italy, Switzerland, Germany,
          Finland, Belgium, Denmark, the Netherlands, Norway, Sweden, Poland, the United Kingdom,
          Ireland, France, Luxembourg, Hungary, and the Czech Republic. Explore more than 26,000
          stations and stops on the map. At stations with live boards you can check departures,
          arrivals, delays, and platforms where reported. Data comes from RFI, Swiss public
          transport feeds, Deutsche Bahn (DB), Finnish Digitraffic, iRail, Rejseplanen, NS, Entur,
          Trafiklab, PLK, LDBWS, Irish Rail, SNCF, Mobiliteit.lu, MÁV, and Správa železnic.
        </p>
        <p>
          Search for a station by name or explore trending stations. Rail Radar supports major
          operators including DB, Trenitalia, Italo, Trenord, SBB, VR, DSB, NMBS/SNCB, NS, Iarnród
          Éireann, SNCF, CFL, MÁV, České dráhy, RegioJet, and many regional services. Bookmark your
          favorite stations for quick access and share live views with friends using shareable map
          links.
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
          <nav aria-label="Explore Rail Radar" className="flex items-center gap-1">
            <Link
              to="/operators"
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Operators
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/stations"
              {...prerenderedPageLinkProps}
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Stations
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/lines"
              {...prerenderedPageLinkProps}
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Lines
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/reports"
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Reports
            </Link>
          </nav>
        </div>
      </Suspense>
    </main>
  );
}
