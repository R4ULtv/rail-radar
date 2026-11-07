import type { CountryCode } from "./countries";

/**
 * The providers instrumented by live station requests, in the order Rail Radar added each country.
 * Keep status and collection in sync.
 */
export const PROVIDERS = [
  { id: "rfi", name: "RFI", country: "it" },
  { id: "opendata-ch", name: "Transport Open Data", country: "ch" },
  { id: "irail", name: "iRail", country: "be" },
  { id: "ns", name: "NS", country: "nl" },
  { id: "digitraffic", name: "Digitraffic", country: "fi" },
  { id: "nationalrail", name: "National Rail", country: "uk" },
  { id: "irishrail", name: "Irish Rail", country: "ie" },
  { id: "entur", name: "Entur", country: "no" },
  { id: "trafiklab", name: "Trafiklab", country: "se" },
  { id: "rejseplanen", name: "Rejseplanen", country: "dk" },
  { id: "db", name: "Deutsche Bahn", country: "de" },
  { id: "plk", name: "PKP PLK", country: "pl" },
  { id: "sncf", name: "SNCF", country: "fr" },
  { id: "mobiliteit", name: "Mobiliteit", country: "lu" },
  { id: "mav", name: "MÁV", country: "hu" },
] as const satisfies readonly { id: string; name: string; country: CountryCode }[];

export type Provider = (typeof PROVIDERS)[number];
export type ProviderId = Provider["id"];
export const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

/** Public context for each provider, shown on the status page. Kept out of API responses. */
export const PROVIDER_DETAILS: Record<ProviderId, { description: string; url: string }> = {
  rfi: {
    description: "Rete Ferroviaria Italiana's station arrivals and departures.",
    url: "https://www.rfi.it",
  },
  "opendata-ch": {
    description: "An open API for Swiss public transport timetables.",
    url: "https://transport.opendata.ch",
  },
  irail: {
    description: "A community-run open API for Belgian rail (NMBS/SNCB).",
    url: "https://docs.irail.be",
  },
  ns: {
    description: "Nederlandse Spoorwegen's travel information API.",
    url: "https://www.ns.nl",
  },
  digitraffic: {
    description: "Fintraffic's open data service for railway traffic in Finland.",
    url: "https://www.digitraffic.fi",
  },
  nationalrail: {
    description: "National Rail's Live Departure Boards Web Service (LDBWS).",
    url: "https://lite.realtime.nationalrail.co.uk",
  },
  irishrail: {
    description: "Iarnród Éireann's realtime train information service.",
    url: "https://www.irishrail.ie",
  },
  entur: {
    description: "Norway's national public transport data platform.",
    url: "https://developer.entur.org",
  },
  trafiklab: {
    description: "Sweden's open public transport data platform.",
    url: "https://www.trafiklab.se",
  },
  rejseplanen: {
    description: "Denmark's national journey planner.",
    url: "https://www.rejseplanen.dk",
  },
  db: {
    description: "Deutsche Bahn's Timetables API.",
    url: "https://developers.deutschebahn.com/db-api-marketplace/apis/product/160163/api/160160",
  },
  plk: {
    description: "PKP Polskie Linie Kolejowe's passenger data API.",
    url: "https://www.plk-sa.pl",
  },
  sncf: {
    description: "SNCF's Navitia API for French rail.",
    url: "https://numerique.sncf.com/startup/api/",
  },
  mobiliteit: {
    description: "Luxembourg's public transport API, licensed under CC BY 4.0.",
    url: "https://data.public.lu/en/datasets/api-mobiliteit-lu/",
  },
  mav: {
    description: "MÁV's timetable and live train information.",
    url: "https://jegy.mav.hu",
  },
};
