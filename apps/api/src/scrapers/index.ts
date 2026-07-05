import { getCountry, type CountryCode } from "@repo/data/countries";

import type { ScrapeResult } from "./core";

import { scrapeBelgiumTrains } from "./belgium";
import { scrapeFinlandTrains } from "./finland";
import { scrapeTrains } from "./italy";
import { scrapeNetherlandsTrains } from "./netherlands";
import { scrapeNorwayTrains } from "./norway";
import { scrapeSwissTrains } from "./switzerland";
import { scrapeIrelandTrains } from "./ireland";
import { scrapeSwedenTrains } from "./sweden";
import { scrapeUKTrains } from "./uk";
import { scrapeGermanTrains } from "./germany";
import { scrapeDenmarkTrains } from "./denmark";
import { scrapePolandTrains } from "./poland";
import { scrapeFranceTrains } from "./france";

export * from "./core";

type ScrapeFn = (
  stationId: string,
  type?: "arrivals" | "departures",
  env?: Record<string, unknown>,
) => Promise<ScrapeResult>;

const scrapers: Partial<Record<CountryCode, ScrapeFn>> = {
  be: scrapeBelgiumTrains,
  ch: scrapeSwissTrains,
  fi: scrapeFinlandTrains,
  ie: scrapeIrelandTrains,
  it: scrapeTrains,
  nl: scrapeNetherlandsTrains,
  no: scrapeNorwayTrains,
  se: scrapeSwedenTrains,
  uk: scrapeUKTrains,
  de: scrapeGermanTrains,
  dk: scrapeDenmarkTrains,
  pl: scrapePolandTrains,
  fr: scrapeFranceTrains,
};

export function getScraperForStation(stationId: string): ScrapeFn | null {
  const country = getCountry(stationId);
  return country ? (scrapers[country] ?? null) : null;
}
