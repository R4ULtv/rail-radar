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

export type ScrapeFn = (
  stationId: string,
  type?: "arrivals" | "departures",
  env?: Record<string, unknown>,
) => Promise<ScrapeResult>;

export interface Scraper {
  regionLabel: string;
  timeZone: string;
  trainLimit: number;
  scrape: ScrapeFn;
}

const scrapers: Partial<Record<CountryCode, Scraper>> = {
  be: {
    regionLabel: "Belgian",
    timeZone: "Europe/Brussels",
    trainLimit: 16,
    scrape: scrapeBelgiumTrains,
  },
  ch: {
    regionLabel: "Swiss",
    timeZone: "Europe/Zurich",
    trainLimit: 16,
    scrape: scrapeSwissTrains,
  },
  fi: {
    regionLabel: "Finnish",
    timeZone: "Europe/Helsinki",
    trainLimit: 16,
    scrape: scrapeFinlandTrains,
  },
  ie: {
    regionLabel: "Irish",
    timeZone: "Europe/Dublin",
    trainLimit: 16,
    scrape: scrapeIrelandTrains,
  },
  it: {
    regionLabel: "Italian",
    timeZone: "Europe/Rome",
    trainLimit: 0,
    scrape: scrapeTrains,
  },
  nl: {
    regionLabel: "Dutch",
    timeZone: "Europe/Amsterdam",
    trainLimit: 16,
    scrape: scrapeNetherlandsTrains,
  },
  no: {
    regionLabel: "Norwegian",
    timeZone: "Europe/Oslo",
    trainLimit: 16,
    scrape: scrapeNorwayTrains,
  },
  se: {
    regionLabel: "Swedish",
    timeZone: "Europe/Stockholm",
    trainLimit: 16,
    scrape: scrapeSwedenTrains,
  },
  uk: {
    regionLabel: "UK",
    timeZone: "Europe/London",
    trainLimit: 30,
    scrape: scrapeUKTrains,
  },
  de: {
    regionLabel: "German",
    timeZone: "Europe/Berlin",
    trainLimit: 24,
    scrape: scrapeGermanTrains,
  },
  dk: {
    regionLabel: "Danish",
    timeZone: "Europe/Copenhagen",
    trainLimit: 24,
    scrape: scrapeDenmarkTrains,
  },
  pl: {
    regionLabel: "Polish",
    timeZone: "Europe/Warsaw",
    trainLimit: 24,
    scrape: scrapePolandTrains,
  },
  fr: {
    regionLabel: "French",
    timeZone: "Europe/Paris",
    trainLimit: 24,
    scrape: scrapeFranceTrains,
  },
};

export function getScraperForStation(stationId: string): ScrapeFn | null {
  const country = getCountry(stationId);
  return country ? (scrapers[country]?.scrape ?? null) : null;
}
