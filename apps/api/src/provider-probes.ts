import { getCountry } from "@repo/data/countries";
import { PROVIDERS, type ProviderId } from "@repo/data/providers";
import { recordProviderMetric, type ProviderMetricResult } from "./analytics";
import type { Bindings } from "./lib/env";
import { getScraperForStation } from "./scrapers";
import { ScraperError } from "./scrapers/core";

/**
 * The station each scheduled probe requests: a top-importance hub per provider, so every probe
 * exercises a busy board and the provider's full parser.
 */
export const PROBE_STATIONS: Record<ProviderId, string> = {
  rfi: "IT2416", // Roma Termini
  "opendata-ch": "CH03000", // Zürich HB
  irail: "BE14001", // Brussel-Zuid/Bruxelles-Midi
  ns: "NL058", // Amsterdam Centraal
  digitraffic: "FI001", // Helsinki
  nationalrail: "UK1444", // London Euston
  irishrail: "IE100", // Dublin Connolly
  entur: "NO59872", // Oslo S
  trafiklab: "SE000001", // Stockholm Centralstation
  rejseplanen: "DK00626", // København H
  db: "DE00105", // Frankfurt (Main) Hbf
  plk: "PL33605", // Warszawa Centralna
  sncf: "FR271007", // Paris Gare du Nord
  mobiliteit: "LU200405060", // Luxembourg, Gare Centrale
  mav: "HU5510017", // Budapest-Keleti
};

/** Fetch the provider's hub departures and record the outcome as a synthetic observation. */
export async function probeProvider(
  env: Bindings,
  provider: ProviderId,
): Promise<ProviderMetricResult> {
  const stationId = PROBE_STATIONS[provider];
  const country = getCountry(stationId) ?? "";
  const record = (result: ProviderMetricResult, fetchMs: number | null, statusCode: number) =>
    recordProviderMetric(env.PROVIDER_ANALYTICS, {
      provider,
      source: "synthetic",
      result,
      requestType: "departures",
      stationId,
      country,
      fetchMs,
      statusCode,
    });

  try {
    const scraper = getScraperForStation(stationId);
    if (!scraper) throw new Error(`No scraper for probe station ${stationId}`);
    const { timing } = await scraper(stationId, "departures", env);
    await record("success", timing.fetchMs, 200);
    return "success";
  } catch (error) {
    // Same classification as live station requests, so both sources mean the same thing.
    const scraperError = error instanceof ScraperError ? error : null;
    const result: ProviderMetricResult = scraperError?.statusCode === 504 ? "timeout" : "error";
    await record(result, scraperError?.timing?.fetchMs ?? null, scraperError?.statusCode ?? 500);
    console.warn(
      JSON.stringify({
        message: "Provider probe failed",
        provider,
        stationId,
        result,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return result;
  }
}

/** Scheduled entry point: one departures request per provider, all in parallel. */
export async function runProviderProbes(env: Bindings) {
  const outcomes = await Promise.all(PROVIDERS.map((provider) => probeProvider(env, provider.id)));
  const results = Object.fromEntries(
    PROVIDERS.map((provider, i) => [provider.id, outcomes[i]]),
  ) as Record<ProviderId, ProviderMetricResult>;
  console.log(JSON.stringify({ message: "Provider probes completed", results }));
  return results;
}
