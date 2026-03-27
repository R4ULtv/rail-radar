import type { Train } from "@repo/data";

import { ScraperError, formatTime, type ScrapeResult } from "./index";
import { fetchWithTimeout } from "./fetch";

const TRAFIKLAB_BASE_URL = "https://realtime-api.trafiklab.se/v1";
const TRAIN_LIMIT = 16;
const SWEDEN_TIMEZONE = "Europe/Stockholm";

// Transport modes we care about (exclude BUS, FERRY, etc.)
const RAIL_MODES = new Set(["TRAIN"]);

type SwedenBoardType = "arrivals" | "departures";

interface TrafiklabDeparture {
  scheduled: string;
  realtime: string | null;
  delay: number; // seconds
  canceled: boolean;
  is_realtime: boolean;
  route: {
    name: string | null;
    designation: string | null;
    transport_mode: string;
    direction: string | null;
    origin: { id: string; name: string } | null;
    destination: { id: string; name: string } | null;
  };
  trip: {
    trip_id: string;
    technical_number: number;
  };
  agency: {
    id: string;
    name: string;
    operator: string;
  };
  scheduled_platform: { id: string; designation: string } | null;
  realtime_platform: { id: string; designation: string } | null;
}

interface TrafiklabResponse {
  timestamp: string;
  departures?: TrafiklabDeparture[];
  arrivals?: TrafiklabDeparture[];
}

function toTrafiklabAreaId(stationId: string): string {
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  if (!numericPart) {
    throw new ScraperError("Unknown Swedish station.", 404);
  }
  return `740${numericPart}`;
}

function getBrand(entry: TrafiklabDeparture): string | null {
  const operator = entry.agency.operator?.trim();
  if (!operator) return entry.agency.name || null;

  const lower = operator.toLowerCase();

  if (lower.startsWith("sj ") || lower === "sj ab") return "SJ";
  if (lower === "vr sverige ab" || lower === "vr sverige") return "VR";
  if (lower === "vygruppen as") return "Vy";
  if (lower === "mtr express ab") return "MTR Express";
  if (lower === "snälltåget ab") return "Snälltåget";
  if (lower === "transdev sverige ab" || lower.startsWith("transdev ")) return "Transdev";
  if (lower === "svenska tågkompaniet ab" || lower === "tågab") return "Transdev";
  if (lower === "värmlandstrafik ab") return "Transdev";

  return operator;
}

function getDelay(entry: TrafiklabDeparture): number | null {
  // delay is in seconds, convert to minutes
  const minutes = Math.round(entry.delay / 60);
  return minutes > 0 ? minutes : null;
}

function getStatus(entry: TrafiklabDeparture, type: SwedenBoardType): Train["status"] {
  if (entry.canceled) return "cancelled";

  const timeStr = entry.realtime ?? entry.scheduled;
  if (!timeStr) return null;

  const actualTime = new Date(timeStr).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (actualTime >= now - fiveMinutes && actualTime <= now + fiveMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function getTrainNumber(entry: TrafiklabDeparture): string {
  return entry.route.designation ?? String(entry.trip.technical_number);
}

function mapEntry(entry: TrafiklabDeparture, type: SwedenBoardType): Train {
  const train: Train = {
    brand: getBrand(entry),
    category: entry.route.designation,
    trainNumber: getTrainNumber(entry),
    scheduledTime: formatTime(entry.scheduled, SWEDEN_TIMEZONE),
    delay: getDelay(entry),
    platform: entry.realtime_platform?.designation ?? entry.scheduled_platform?.designation ?? null,
    status: getStatus(entry, type),
    info: entry.is_realtime ? null : "Scheduled data only",
  };

  if (type === "departures") {
    train.destination = entry.route.destination?.name ?? entry.route.direction ?? undefined;
  } else {
    train.origin = entry.route.origin?.name ?? undefined;
  }

  return train;
}

export async function scrapeSwedenTrains(
  stationId: string,
  type: SwedenBoardType = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.TRAFIKLAB_KEY as string | undefined;
  if (!apiKey) {
    throw new ScraperError("Swedish train data source is not configured.", 500);
  }

  const areaId = toTrafiklabAreaId(stationId);
  const path = type === "departures" ? "departures" : "arrivals";
  const url = `${TRAFIKLAB_BASE_URL}/${path}/${areaId}?key=${apiKey}`;

  const { response, fetchMs } = await fetchWithTimeout(url, "Swedish", {
    headers: { Accept: "application/json" },
  });

  const data: TrafiklabResponse = await response.json();

  const entries = (type === "departures" ? data.departures : data.arrivals) ?? [];

  // Filter to rail only, deduplicate, and limit
  const seen = new Set<string>();
  const trains = entries
    .filter((entry) => {
      if (!RAIL_MODES.has(entry.route.transport_mode)) return false;
      // Deduplicate by train number + scheduled time
      const dedupKey = `${getTrainNumber(entry)}-${entry.scheduled}`;
      if (seen.has(dedupKey)) return false;
      seen.add(dedupKey);
      return true;
    })
    .slice(0, TRAIN_LIMIT)
    .map((entry) => mapEntry(entry, type));

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
