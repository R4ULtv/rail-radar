import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { Train } from "@repo/data";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ScraperError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

const BASE_URL =
  "https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor";

function buildUrl(stationId: number, arrivals: boolean): string {
  if (arrivals) {
    return `${BASE_URL}?placeId=${stationId}&arrivals=True`;
  }
  return `${BASE_URL}?Arrivals=False&Search=&PlaceId=${stationId}`;
}

interface DelayResult {
  delay: number | null;
  cancelled: boolean;
}

function parseDelay(text: string | undefined): DelayResult {
  if (!text) return { delay: null, cancelled: false };
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "on time") {
    return { delay: 0, cancelled: false };
  }
  if (trimmed.toLowerCase() === "cancelled") {
    return { delay: null, cancelled: true };
  }
  const num = parseInt(trimmed, 10);
  return { delay: isNaN(num) ? null : num, cancelled: false };
}

function parseCategory(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/^Categoria\s+/i, "").trim() || null;
}

function parseInfo(text: string | undefined): string | null {
  if (!text) return null;
  // Extract just the stops, remove "Train XXX" and "Next stops" prefixes
  const match = text.match(/STOPS AT:\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function parseStatus(
  $cell: Cheerio<Element>,
  isArrivals: boolean,
): Train["status"] {
  const img = $cell.find("img");
  const src = img.attr("src") || "";
  if (src.includes("LampeggioGold") || src.includes("LampeggioGrey")) {
    return isArrivals ? "incoming" : "departing";
  }
  return null;
}

export interface ScrapeResult {
  trains: Train[];
  info: string | null;
}

function parseStationInfo($: CheerioAPI): string | null {
  // Look for the station info bar with marquee containing supplementary info
  const marquee = $(".barrainfostazione .marqueeinfosupp");
  if (marquee.length > 0) {
    const text = marquee.text().trim();
    return text || null;
  }
  return null;
}

export async function scrapeTrains(
  stationId: number,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildUrl(stationId, type === "arrivals");

  const response = await fetch(url);
  if (!response.ok) {
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const trains: Train[] = [];

  // The page uses table rows for train data
  // Selectors may need adjustment based on actual HTML structure
  $("table tbody tr").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td");

    if (cells.length < 5) return; // Skip header or invalid rows

    const rawCategory =
      cells.eq(1).find("img").attr("alt") || cells.eq(1).text().trim() || null;
    const delayResult = parseDelay(cells.eq(5).text());
    const statusFromImage = parseStatus(cells.eq(7), type === "arrivals");

    const train: Train = {
      brand: cells.eq(0).find("img").attr("alt") || null,
      category: parseCategory(rawCategory),
      trainNumber: cells.eq(2).text().trim(),
      ...(type === "departures"
        ? { destination: cells.eq(3).text().trim() }
        : { origin: cells.eq(3).text().trim() }),
      scheduledTime: cells.eq(4).text().trim(),
      delay: delayResult.delay,
      platform: cells.eq(6).text().trim() || null,
      status: delayResult.cancelled ? "cancelled" : statusFromImage,
      info: parseInfo(cells.eq(8).text()),
    };

    // Only add if we have a train number
    if (train.trainNumber) {
      trains.push(train);
    }
  });

  const info = parseStationInfo($);

  return { trains, info };
}
