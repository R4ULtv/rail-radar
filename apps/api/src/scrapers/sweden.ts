import type { Train } from "@repo/data";

import { ScraperError, type ScrapeResult } from "./core";
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
    transport_mode_code: number;
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
  stop: { id: string; name: string; lat: number; lon: number };
  scheduled_platform: { id: string; designation: string } | null;
  realtime_platform: { id: string; designation: string } | null;
  alerts: { type: string; title: string; text: string }[];
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

// GTFS route_type codes → short category codes
function getCategory(entry: TrafiklabDeparture): string | null {
  const code = entry.route.transport_mode_code;

  switch (code) {
    case 101:
      return "HS"; // High Speed Rail
    case 102:
      return "IC"; // Long Distance Rail
    case 103:
      return "IR"; // Inter-Regional Rail
    case 104:
      return "IC"; // Cross-Country Rail
    case 105:
      return "SLP"; // Sleeper Rail
    case 106:
      return "RE"; // Regional Rail
    case 107:
      return "RE"; // Tourist Railway
    case 109:
      return "S"; // Suburban Railway
    case 100:
      return "RE"; // Railway Service (generic)
    default:
      return null;
  }
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

function formatLocalTime(value: string | null): string {
  const match = value?.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "--:--";
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return localTime - date.getTime();
}

function parseStockholmLocalTime(value: string | null): number | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  return utcTime - getTimeZoneOffsetMs(SWEDEN_TIMEZONE, new Date(utcTime));
}

function getStatus(entry: TrafiklabDeparture, type: SwedenBoardType): Train["status"] {
  if (entry.canceled) return "cancelled";

  const timeStr = entry.realtime ?? entry.scheduled;
  if (!timeStr) return null;

  const actualTime = parseStockholmLocalTime(timeStr);
  if (actualTime == null) return null;

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
    category: getCategory(entry),
    trainNumber: getTrainNumber(entry),
    scheduledTime: formatLocalTime(entry.scheduled),
    delay: getDelay(entry),
    platform: entry.realtime_platform?.designation ?? entry.scheduled_platform?.designation ?? null,
    status: getStatus(entry, type),
    info: entry.alerts[0]?.title ?? null,
  };

  if (type === "departures") {
    const dest = entry.route.destination?.name;
    const origin = entry.route.origin?.name;
    const isCircular = dest && origin && dest === origin;
    train.destination = isCircular
      ? (entry.route.direction ?? entry.route.name ?? dest)
      : (dest ?? entry.route.direction ?? undefined);
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
      // Skip trains terminating at this station (showing in departures but going nowhere)
      if (type === "departures" && entry.stop.name === entry.route.destination?.name) return false;
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
