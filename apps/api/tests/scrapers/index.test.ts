import { describe, expect, it } from "vitest";

import { COUNTRY_CODES, HIDDEN_COUNTRIES } from "@repo/data/countries";

import { getProviderByStationId } from "../../src/analytics";
import { scrapeBelgiumTrains } from "../../src/scrapers/belgium";
import { scrapeHungaryTrains } from "../../src/scrapers/hungary";
import { SCRAPER_COUNTRIES, getScraperForStation } from "../../src/scrapers";
import { scrapeTrains as scrapeItalyTrains } from "../../src/scrapers/italy";
import { scrapeUKTrains } from "../../src/scrapers/uk";

describe("scraper registry", () => {
  it("has a scraper for every supported country", () => {
    expect([...SCRAPER_COUNTRIES].sort()).toEqual([...COUNTRY_CODES].sort());
  });

  it("has a provider for every scraper country", () => {
    for (const country of SCRAPER_COUNTRIES) {
      expect(getProviderByStationId(`${country.toUpperCase()}1`), country).not.toBeNull();
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(SCRAPER_COUNTRIES)).toBe(true);
  });

  it("resolves the scraper from the station ID prefix", () => {
    expect(getScraperForStation("BE14001")).toBe(scrapeBelgiumTrains);
    expect(getScraperForStation("IT1728")).toBe(scrapeItalyTrains);
    expect(getScraperForStation("UK123")).toBe(scrapeUKTrains);
    if (!HIDDEN_COUNTRIES.includes("hu")) {
      expect(getScraperForStation("HU1")).toBe(scrapeHungaryTrains);
    }
  });

  it("serves no scraper for hidden countries", () => {
    for (const country of HIDDEN_COUNTRIES) {
      expect(getScraperForStation(`${country.toUpperCase()}1`), country).toBeNull();
    }
  });

  it("returns null for unknown regions", () => {
    expect(getScraperForStation("ES123")).toBeNull();
    expect(getScraperForStation("123")).toBeNull();
    expect(getScraperForStation("")).toBeNull();
  });
});
