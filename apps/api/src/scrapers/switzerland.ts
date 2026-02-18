import type { Train } from "@repo/data";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError, type ScrapeResult } from "./index";

const SWISS_BASE_URL = "http://transport.opendata.ch/v1/stationboard";

function convertSwissStationId(stationId: string): string {
  // Convert CH station ID to 85 prefix (e.g., "CH06013" -> "8506013")
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  return `85${numericPart}`;
}

function buildSwissUrl(stationId: string, arrivals: boolean): string {
  const convertedId = convertSwissStationId(stationId);
  const direction = arrivals ? "arrival" : "departure";
  return `${SWISS_BASE_URL}?id=${convertedId}&type=${direction}&limit=16&transportations=train`;
}

// Swiss API types (only fields we use)
interface Stop {
  station: { name: string | null };
  arrival: string | null;
  departure: string | null;
  delay: number | null;
  platform: string | null;
  prognosis: { platform: string | null };
}

interface StationboardEntry {
  stop: Stop;
  category: string;
  number: string | null;
  name: string | null;
  operator: string;
  to: string;
  passList: Stop[];
}

interface TransportResponse {
  stationboard: StationboardEntry[];
}

// Format ISO 8601 timestamp to "HH:MM"
function formatTimeFromISO(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

// Get scheduled time for arrivals - use departure time since that's when train is at the platform
// (arrival time at current station is not provided, only arrival at final destination)
function getArrivalTime(stop: Stop): string {
  return formatTimeFromISO(stop.departure ?? stop.arrival);
}

// Prefer real-time platform from prognosis
function getSwissPlatform(stop: Stop): string | null {
  return stop.prognosis?.platform ?? stop.platform ?? null;
}

// Determine status based on 2-minute window (accounting for delay)
function getSwissStatus(
  stop: Stop,
  type: "arrivals" | "departures",
): "incoming" | "departing" | null {
  // For arrivals, use departure time since arrival at current station is not provided
  const timeStr = stop.departure ?? stop.arrival;
  if (!timeStr) return null;

  const scheduledTime = new Date(timeStr).getTime();
  const delay = (stop.delay ?? 0) * 60 * 1000; // convert minutes to ms
  const actualTime = scheduledTime + delay;
  const now = Date.now();

  // Within 3 minutes (past or future)
  const twoMinutes = 3 * 60 * 1000;
  if (actualTime >= now - twoMinutes && actualTime <= now + twoMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

export async function scrapeSwissTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildSwissUrl(stationId, type === "arrivals");
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    const fetchError =
      error instanceof Error ? error : new Error(String(error));
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    if (fetchError.name === "AbortError") {
      throw new ScraperError(
        "The Swiss train data source is taking too long to respond. Please try again.",
        504,
        { fetchMs },
      );
    }
    throw new ScraperError(
      "Unable to connect to the Swiss train data source. Please try again.",
      502,
      { fetchMs },
    );
  }
  const fetchMs = performance.now() - startTime;
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
      { fetchMs },
    );
  }

  const data: TransportResponse = await response.json();

  const trains: Train[] = data.stationboard.map((entry) => {
    const stop = entry.stop;
    const scheduledTime =
      type === "departures"
        ? formatTimeFromISO(stop.departure)
        : getArrivalTime(stop);

    // Combine category + line number, trimming leading zeros (e.g., "EC000021" → "EC21")
    const lineNumber = entry.number?.replace(/^0+/, "") || entry.number || "";
    const trainNumber = entry.name?.replace(/^0+/, "") || entry.name || "";

    const train: Train = {
      brand: entry.operator?.split("-")[0] || null,
      category: `${entry.category}${lineNumber}` || null,
      trainNumber: trainNumber,
      scheduledTime,
      delay: stop.delay,
      platform: getSwissPlatform(stop),
      status: getSwissStatus(stop, type),
      info: null,
    };

    if (type === "departures") {
      train.destination = entry.to;
    } else {
      // For arrivals, origin is the last named station in passList (where train came from)
      const origin = entry.passList?.filter((stop) => stop.station.name).at(-1)
        ?.station.name;
      train.origin = origin ?? entry.to;
    }

    return train;
  });

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
