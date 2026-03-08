import type { Train } from "@repo/data";

import type { ScrapeResult } from "./index";
import { ScraperError } from "./index";
import { fetchWithTimeout } from "./fetch";

const NS_BASE_URL = "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2";

function convertNetherlandsStationId(stationId: string): string {
  if (stationId.startsWith("NLM")) {
    throw new ScraperError("Metro stations are not supported by the NS API.", 404);
  }
  const numericPart = stationId.replace(/^NL/, "");
  return `8400${numericPart}`;
}

function buildNetherlandsUrl(uicCode: string, arrivals: boolean): string {
  const endpoint = arrivals ? "arrivals" : "departures";
  return `${NS_BASE_URL}/${endpoint}?uicCode=${uicCode}&lang=en&maxJourneys=16`;
}

// NS API response types

interface NSMessage {
  message: string;
  style: string;
}

interface NSDeparture {
  direction: string;
  name: string;
  plannedDateTime: string;
  actualDateTime?: string;
  plannedTrack?: string;
  actualTrack?: string;
  trainCategory: string;
  cancelled: boolean;
  messages: NSMessage[];
  departureStatus: "ON_STATION" | "INCOMING" | "DEPARTED" | "UNKNOWN";
}

interface NSArrival {
  origin: string;
  name: string;
  plannedDateTime: string;
  actualDateTime?: string;
  plannedTrack?: string;
  actualTrack?: string;
  trainCategory: string;
  cancelled: boolean;
  messages: NSMessage[];
  arrivalStatus: "ON_STATION" | "INCOMING" | "DEPARTED" | "UNKNOWN";
}

interface NSDeparturesResponse {
  payload: {
    departures: NSDeparture[];
  };
}

interface NSArrivalsResponse {
  payload: {
    arrivals: NSArrival[];
  };
}

function getBrand(trainCategory: string): string {
  switch (trainCategory) {
    case "ICE":
      return "DB";
    case "EUR":
      return "Eurostar";
    case "TGV":
      return "SNCF";
    case "THA":
      return "Thalys";
    default:
      return "NS";
  }
}

function formatTimeFromISO(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

function calculateDelay(planned: string, actual?: string): number | null {
  if (!actual) return null;
  const diff = Math.round((new Date(actual).getTime() - new Date(planned).getTime()) / 60000);
  return diff > 0 ? diff : null;
}

function getStatus(
  entry: NSDeparture | NSArrival,
  type: "arrivals" | "departures",
): Train["status"] {
  if (entry.cancelled) return "cancelled";

  const actualTime = new Date(entry.actualDateTime ?? entry.plannedDateTime).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (actualTime >= now - fiveMinutes && actualTime <= now + fiveMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function parseTrainNumber(name: string): string {
  // "SPR 4043" -> "4043", "IC  2256" -> "2256", "Int  9382" -> "9382", "NS703062" -> "703062"
  const match = name.match(/\d+$/);
  if (match) return match[0];
  return name;
}

export async function scrapeNetherlandsTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.NS_API_KEY;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new ScraperError("NS API key is not configured.", 500);
  }

  const uicCode = convertNetherlandsStationId(stationId);
  const url = buildNetherlandsUrl(uicCode, type === "arrivals");

  const { response, fetchMs } = await fetchWithTimeout(url, "Dutch", {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });

  const now = Date.now();
  const recentWindow = 5 * 60 * 1000;

  if (type === "arrivals") {
    const data: NSArrivalsResponse = await response.json();
    const entries = data?.payload?.arrivals ?? [];

    const filtered = entries.filter((entry) => {
      if (entry.cancelled) return true;
      if (entry.arrivalStatus === "DEPARTED") return true;
      const actualTime = new Date(entry.actualDateTime ?? entry.plannedDateTime).getTime();
      return actualTime >= now - recentWindow;
    });

    const trains: Train[] = filtered.map((entry) => ({
      brand: getBrand(entry.trainCategory),
      category: entry.trainCategory || null,
      trainNumber: parseTrainNumber(entry.name),
      origin: entry.origin,
      scheduledTime: formatTimeFromISO(entry.plannedDateTime),
      delay: calculateDelay(entry.plannedDateTime, entry.actualDateTime),
      platform: entry.actualTrack ?? entry.plannedTrack ?? null,
      status: getStatus(entry, type),
      info: entry.messages.length > 0 ? entry.messages.map((m) => m.message).join("; ") : null,
    }));

    return { trains, info: null, timing: { fetchMs } };
  }

  const data: NSDeparturesResponse = await response.json();
  const entries = data?.payload?.departures ?? [];

  const filtered = entries.filter((entry) => {
    if (entry.cancelled) return true;
    if (entry.departureStatus === "DEPARTED") return true;
    const actualTime = new Date(entry.actualDateTime ?? entry.plannedDateTime).getTime();
    return actualTime >= now - recentWindow;
  });

  const trains: Train[] = filtered.map((entry) => ({
    brand: getBrand(entry.trainCategory),
    category: entry.trainCategory || null,
    trainNumber: parseTrainNumber(entry.name),
    destination: entry.direction,
    scheduledTime: formatTimeFromISO(entry.plannedDateTime),
    delay: calculateDelay(entry.plannedDateTime, entry.actualDateTime),
    platform: entry.actualTrack ?? entry.plannedTrack ?? null,
    status: getStatus(entry, type),
    info: entry.messages.length > 0 ? entry.messages.map((m) => m.message).join("; ") : null,
  }));

  return { trains, info: null, timing: { fetchMs } };
}
