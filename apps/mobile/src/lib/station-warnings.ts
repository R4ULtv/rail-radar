import { getCountry, type CountryCode } from "@repo/data/countries";

// Same notes as the web (apps/web/src/components/station-warning.tsx).
const stationWarnings: Partial<Record<CountryCode, string>> = {
  pl: "Live data for stations in Poland may be unstable or incomplete right now. We are working to improve it.",
  ie: "Platform information is currently unavailable for stations in Ireland. We are working to improve it.",
  fr: "Platform and origin information may be missing for stations in France. We are working to improve it.",
  lu: "Live arrivals are not available yet for train stations in Luxembourg. We are working to add them.",
};

/** A note about the live data's quality in the station's country, if there is one. */
export function getStationWarning(stationId: string): string | null {
  const country = getCountry(stationId);
  return (country && stationWarnings[country]) || null;
}
