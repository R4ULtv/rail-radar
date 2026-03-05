import type { Train } from "@repo/data";
import fiStationCodes from "./fi-codes.json";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError, type ScrapeResult } from "./index";

const DIGITRAFFIC_BASE_URL = "https://rata.digitraffic.fi/api/v1";
const TRAIN_LIMIT = 16;

// Static UIC code → shortCode mapping
const stationCodes = fiStationCodes as Record<string, string>;

// Reverse mapping: shortCode → station name
import { stationById } from "@repo/data/stations";

const shortCodeToName = new Map<string, string>();
for (const [uic, code] of Object.entries(stationCodes)) {
  const station = stationById.get(`FI${uic}`);
  if (station) shortCodeToName.set(code, station.name.replace(/ asema$/, ""));
}

function getStationName(shortCode: string): string {
  return shortCodeToName.get(shortCode) ?? shortCode;
}

// Digitraffic API types
interface TimeTableRow {
  stationShortCode: string;
  stationUICCode: number;
  type: "ARRIVAL" | "DEPARTURE";
  trainStopping: boolean;
  commercialStop?: boolean;
  cancelled: boolean;
  scheduledTime: string;
  liveEstimateTime?: string;
  actualTime?: string;
  differenceInMinutes: number;
  commercialTrack?: string;
}

interface DigitrafficTrain {
  trainNumber: number;
  trainType: string;
  trainCategory: string;
  commuterLineID: string;
  operatorShortCode: string;
  runningCurrently: boolean;
  cancelled: boolean;
  timeTableRows: TimeTableRow[];
}

function getShortCode(stationId: string): string {
  // Extract padded numeric part from FI station ID (e.g., "FI001" -> "001")
  const paddedCode = stationId.replace(/^[A-Z]+/, "");
  const shortCode = stationCodes[paddedCode];
  if (!shortCode) throw new ScraperError("Unknown Finnish station.", 404);
  return shortCode;
}

function buildUrl(shortCode: string, type: "arrivals" | "departures"): string {
  const params =
    type === "arrivals"
      ? `arriving_trains=${TRAIN_LIMIT}&departing_trains=0&arrived_trains=0&departed_trains=0`
      : `departing_trains=${TRAIN_LIMIT}&arriving_trains=0&arrived_trains=0&departed_trains=0`;

  return `${DIGITRAFFIC_BASE_URL}/live-trains/station/${shortCode}?${params}`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  });
}

function getStationRow(
  rows: TimeTableRow[],
  stationShortCode: string,
  rowType: "ARRIVAL" | "DEPARTURE",
): TimeTableRow | undefined {
  return rows.find((r) => r.stationShortCode === stationShortCode && r.type === rowType);
}

function getStatus(
  row: TimeTableRow,
  type: "arrivals" | "departures",
): "incoming" | "departing" | null {
  const timeStr = row.liveEstimateTime ?? row.actualTime ?? row.scheduledTime;
  const time = new Date(timeStr).getTime();
  const now = Date.now();
  const threeMinutes = 3 * 60 * 1000;

  if (time >= now - threeMinutes && time <= now + threeMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }
  return null;
}

interface MappedTrain {
  train: Train;
  sortTime: string; // ISO timestamp for correct chronological sorting
}

function mapTrain(
  entry: DigitrafficTrain,
  stationShortCode: string,
  type: "arrivals" | "departures",
): MappedTrain | null {
  const rows = entry.timeTableRows;
  const commercialStops = rows.filter((r) => r.commercialStop);

  // Find the row for this station
  const rowType = type === "departures" ? "DEPARTURE" : "ARRIVAL";
  const stationRow = getStationRow(rows, stationShortCode, rowType);
  if (!stationRow) return null;

  // Skip cancelled trains whose scheduled time is more than 10 minutes in the past
  if (entry.cancelled) {
    const scheduled = new Date(stationRow.scheduledTime).getTime();
    if (scheduled < Date.now() - 10 * 60 * 1000) return null;
  }

  // Origin = first commercial DEPARTURE station, destination = last commercial ARRIVAL station
  const origin = commercialStops.find((r) => r.type === "DEPARTURE");
  const destination = [...commercialStops].reverse().find((r) => r.type === "ARRIVAL");

  const scheduledTime = formatTime(stationRow.scheduledTime);
  const category = entry.commuterLineID
    ? `${entry.trainType}${entry.commuterLineID}`
    : entry.trainType;

  const train: Train = {
    brand: entry.operatorShortCode.toUpperCase(),
    category,
    trainNumber: String(entry.trainNumber),
    scheduledTime,
    delay: stationRow.differenceInMinutes ?? null,
    platform: stationRow.commercialTrack || null,
    status: entry.cancelled ? "cancelled" : getStatus(stationRow, type),
    info: null,
  };

  if (type === "departures") {
    train.destination = destination ? getStationName(destination.stationShortCode) : "";
  } else {
    train.origin = origin ? getStationName(origin.stationShortCode) : "";
  }

  return { train, sortTime: stationRow.scheduledTime };
}

export async function scrapeFinlandTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const startTime = performance.now();
  const shortCode = getShortCode(stationId);
  const url = buildUrl(shortCode, type);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Encoding": "gzip" },
    });
  } catch (error) {
    const fetchError = error instanceof Error ? error : new Error(String(error));
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    if (fetchError.name === "AbortError") {
      throw new ScraperError(
        "The Finnish train data source is taking too long to respond. Please try again.",
        504,
        { fetchMs },
      );
    }
    throw new ScraperError(
      "Unable to connect to the Finnish train data source. Please try again.",
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

  const data: DigitrafficTrain[] = await response.json();

  const trains: Train[] = data
    .filter((entry) => entry.trainCategory !== "On-track machines")
    .map((entry) => mapTrain(entry, shortCode, type))
    .filter((t): t is MappedTrain => t !== null)
    .sort((a, b) => a.sortTime.localeCompare(b.sortTime))
    .map((t) => t.train);

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
