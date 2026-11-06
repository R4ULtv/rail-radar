import type { CountryCode } from "./countries";

/** The providers instrumented by live station requests. Keep status and collection in sync. */
export const PROVIDERS = [
  { id: "digitraffic", name: "Digitraffic", country: "fi" },
  { id: "entur", name: "Entur", country: "no" },
  { id: "irail", name: "iRail", country: "be" },
  { id: "irishrail", name: "Irish Rail", country: "ie" },
  { id: "ns", name: "NS", country: "nl" },
  { id: "opendata-ch", name: "Transport Open Data", country: "ch" },
  { id: "rfi", name: "RFI", country: "it" },
  { id: "nationalrail", name: "National Rail", country: "uk" },
  { id: "sncf", name: "SNCF", country: "fr" },
  { id: "db", name: "Deutsche Bahn", country: "de" },
  { id: "rejseplanen", name: "Rejseplanen", country: "dk" },
  { id: "plk", name: "PKP PLK", country: "pl" },
  { id: "trafiklab", name: "Trafiklab", country: "se" },
  { id: "mobiliteit", name: "Mobiliteit", country: "lu" },
  { id: "mav", name: "MÁV", country: "hu" },
] as const satisfies readonly { id: string; name: string; country: CountryCode }[];

export type Provider = (typeof PROVIDERS)[number];
export type ProviderId = Provider["id"];
export const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);
