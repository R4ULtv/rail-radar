import type { Train } from "@repo/data";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError, type ScrapeResult } from "./index";

const IRAIL_BASE_URL = "https://api.irail.be/liveboard/";

function convertBelgiumStationId(stationId: string): string {
  // Convert BE station ID to iRail format (e.g., "BE95000" -> "BE.NMBS.008895000")
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  return `BE.NMBS.0088${numericPart}`;
}

function buildBelgiumUrl(stationId: string, arrivals: boolean): string {
  const convertedId = convertBelgiumStationId(stationId);
  const direction = arrivals ? "arrival" : "departure";
  return `${IRAIL_BASE_URL}?id=${convertedId}&arrdep=${direction}&format=json&lang=en`;
}

// iRail API types (only fields we use)
interface VehicleInfo {
  shortname: string;
  number: string;
  type: string;
}

interface PlatformInfo {
  name: string;
  normal: string;
}

interface LiveboardEntry {
  station: string;
  time: string;
  delay: string;
  canceled: string;
  left?: string;
  arrived?: string;
  vehicle: string;
  vehicleinfo: VehicleInfo;
  platform: string;
  platforminfo: PlatformInfo;
}

interface LiveboardResponse {
  departures?: { departure: LiveboardEntry[] };
  arrivals?: { arrival: LiveboardEntry[] };
}

function getBrand(type: string): string {
  switch (type) {
    case "EUR":
      return "Eurostar";
    case "TGV":
      return "SNCF";
    case "ICE":
      return "DB";
    default:
      return "SNCB";
  }
}

function formatTimeFromUnix(unixSeconds: string): string {
  const date = new Date(parseInt(unixSeconds, 10) * 1000);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function getBelgiumStatus(
  entry: LiveboardEntry,
  type: "arrivals" | "departures",
): "incoming" | "departing" | "cancelled" | null {
  if (entry.canceled === "1") return "cancelled";

  if (type === "departures" && entry.left === "1") return "departing";
  if (type === "arrivals" && entry.arrived === "1") return "incoming";

  // Check if train is within 3-minute window
  const scheduledTime = parseInt(entry.time, 10) * 1000;
  const delay = parseInt(entry.delay, 10) * 1000;
  const actualTime = scheduledTime + delay;
  const now = Date.now();
  const threeMinutes = 3 * 60 * 1000;

  if (actualTime >= now - threeMinutes && actualTime <= now + threeMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

export async function scrapeBelgiumTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildBelgiumUrl(stationId, type === "arrivals");
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    const fetchError = error instanceof Error ? error : new Error(String(error));
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    if (fetchError.name === "AbortError") {
      throw new ScraperError(
        "The Belgian train data source is taking too long to respond. Please try again.",
        504,
        { fetchMs },
      );
    }
    throw new ScraperError(
      "Unable to connect to the Belgian train data source. Please try again.",
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

  const data: LiveboardResponse = await response.json();

  const entries = (
    type === "departures" ? (data.departures?.departure ?? []) : (data.arrivals?.arrival ?? [])
  ).slice(0, 16);

  const now = Date.now();
  const threeMinutes = 3 * 60 * 1000;

  const filtered = entries.filter((entry) => {
    if (entry.canceled === "1") return true;
    if (type === "departures" && entry.left === "1") return true;
    if (type === "arrivals" && entry.arrived === "1") return true;
    const actualTime = parseInt(entry.time, 10) * 1000 + parseInt(entry.delay || "0", 10) * 1000;
    return actualTime >= now - threeMinutes;
  });

  const trains: Train[] = filtered.map((entry) => {
    const delaySeconds = parseInt(entry.delay, 10);
    const delayMinutes = Math.round(delaySeconds / 60);

    const train: Train = {
      brand: getBrand(entry.vehicleinfo.type),
      category: entry.vehicleinfo.type || null,
      trainNumber: entry.vehicleinfo.number,
      scheduledTime: formatTimeFromUnix(entry.time),
      delay: delayMinutes || null,
      platform: entry.platforminfo?.name || entry.platform || null,
      status: getBelgiumStatus(entry, type),
      info: null,
    };

    if (type === "departures") {
      train.destination = entry.station;
    } else {
      train.origin = entry.station;
    }

    return train;
  });

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
