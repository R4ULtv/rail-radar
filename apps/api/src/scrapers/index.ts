import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getCountry, type CountryCode, type Train } from "@repo/data";

import { scrapeBelgiumTrains } from "./belgium";
import { scrapeFinlandTrains } from "./finland";
import { scrapeTrains } from "./italy";
import { scrapeNetherlandsTrains } from "./netherlands";
import { scrapeSwissTrains } from "./switzerland";

export interface ScraperTiming {
  fetchMs: number;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode,
    public timing?: ScraperTiming,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

export interface ScrapeResult {
  trains: Train[];
  info: string | null;
  timing: ScraperTiming;
}

type ScrapeFn = (
  stationId: string,
  type?: "arrivals" | "departures",
  env?: Record<string, unknown>,
) => Promise<ScrapeResult>;

const scrapers: Partial<Record<CountryCode, ScrapeFn>> = {
  be: scrapeBelgiumTrains,
  ch: scrapeSwissTrains,
  fi: scrapeFinlandTrains,
  it: scrapeTrains,
  nl: scrapeNetherlandsTrains,
};

export function getScraperForStation(stationId: string): ScrapeFn | null {
  const country = getCountry(stationId);
  return country ? (scrapers[country] ?? null) : null;
}
