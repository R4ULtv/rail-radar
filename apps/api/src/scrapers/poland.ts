import type { Train } from "@repo/data";

import { ScraperError, formatTime, type ScrapeResult } from "./index";
import { fetchWithTimeout } from "./fetch";

const POLAND_BASE_URL = "https://pdp-api.plk-sa.pl/api/v1";
const POLAND_TIMEZONE = "Europe/Warsaw";
const TRAIN_LIMIT = 24;
const RECENT_WINDOW_MS = 10 * 60 * 1000;
const POLAND_HEADERS = {
  Accept: "application/json",
};

type PolandBoardType = "arrivals" | "departures";

interface PolandOperationResponse {
  generatedAt: string;
  trains?: PolandOperationTrain[] | null;
  stations?: Record<string, string> | null;
}

interface PolandOperationTrain {
  scheduleId: number;
  orderId: number;
  trainOrderId: number;
  operatingDate: string;
  trainStatus?: string | null;
  stations?: PolandOperationStop[] | null;
}

interface PolandOperationStop {
  stationId: number;
  plannedSequenceNumber?: number | null;
  actualSequenceNumber: number;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  arrivalDelayMinutes?: number | null;
  departureDelayMinutes?: number | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  isConfirmed: boolean;
  isCancelled: boolean;
}

interface ParsedTimeSpan {
  display: string;
  sortMinutes: number;
}

interface MappedTrain {
  key: string;
  train: Train;
  sortMinutes: number;
}

function toPolandStationNumber(stationId: string): number {
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  if (!/^\d+$/.test(numericPart)) {
    throw new ScraperError("Unknown Polish station.", 404);
  }
  return Number(numericPart);
}

function buildPolandUrl(path: string, params: Record<string, string | number | boolean>): string {
  const url = new URL(`${POLAND_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function routeKey(scheduleId: number, orderId: number): string {
  return `${scheduleId}:${orderId}`;
}

function getOperationPlannedTime(
  stop: PolandOperationStop | undefined,
  type: PolandBoardType,
): ParsedTimeSpan | null {
  const plannedTime = getPlannedEventTime(stop, type);
  if (!plannedTime) return null;

  return parseIsoTime(plannedTime);
}

function getPlannedEventTime(
  stop: PolandOperationStop | undefined,
  type: PolandBoardType,
): string | null {
  if (!stop) return null;
  return type === "departures" ? (stop.plannedDeparture ?? null) : (stop.plannedArrival ?? null);
}

function parseIsoTime(value: string | null): ParsedTimeSpan | null {
  if (!value) return null;
  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: POLAND_TIMEZONE,
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    display: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    sortMinutes: hours * 60 + minutes,
  };
}

function getDelay(stop: PolandOperationStop | undefined, type: PolandBoardType): number | null {
  if (!stop) return null;

  const delay = type === "departures" ? stop.departureDelayMinutes : stop.arrivalDelayMinutes;
  return delay != null && delay > 0 ? delay : null;
}

function getActualEventTime(
  stop: PolandOperationStop | undefined,
  type: PolandBoardType,
): string | null {
  if (!stop) return null;
  return type === "departures" ? (stop.actualDeparture ?? null) : (stop.actualArrival ?? null);
}

function getStatus(stop: PolandOperationStop | undefined, type: PolandBoardType): Train["status"] {
  if (!stop) return null;
  if (stop.isCancelled) return "cancelled";

  const actualTime = getActualEventTime(stop, type);
  if (!actualTime) return null;

  const timestamp = new Date(actualTime).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (timestamp >= now - fiveMinutes && timestamp <= now + fiveMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function shouldIncludeTrain(
  operation: PolandOperationTrain,
  stop: PolandOperationStop | undefined,
  type: PolandBoardType,
): boolean {
  if (!stop) return false;
  if (stop.isCancelled) return true;

  const actualTime = getActualEventTime(stop, type);
  if (actualTime) {
    return new Date(actualTime).getTime() >= Date.now() - RECENT_WINDOW_MS;
  }

  return operation.trainStatus?.toLowerCase() !== "completed";
}

function getTrainInfo(
  operation: PolandOperationTrain,
  stop: PolandOperationStop | undefined,
): string | null {
  if (stop && !stop.isConfirmed) return "Awaiting confirmation";

  const status = operation.trainStatus?.trim();
  if (!status) return null;

  const normalized = status.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "partialcancelled") return "Partially cancelled";
  if (normalized === "cancelled") return "Cancelled";

  return null;
}


function mapTrain(
  operation: PolandOperationTrain,
  currentStationId: number,
  type: PolandBoardType,
): MappedTrain | null {
  const operationStop = operation.stations?.find((stop) => stop.stationId === currentStationId);
  if (!shouldIncludeTrain(operation, operationStop, type)) return null;

  const scheduled = getOperationPlannedTime(operationStop, type);
  const actual = getActualEventTime(operationStop, type);

  const train: Train = {
    brand: null,
    category: null,
    trainNumber: String(operation.trainOrderId),
    scheduledTime: scheduled?.display ?? formatTime(actual, POLAND_TIMEZONE),
    delay: getDelay(operationStop, type),
    platform: null,
    status: getStatus(operationStop, type),
    info: getTrainInfo(operation, operationStop),
  };

  return {
    key: `${routeKey(operation.scheduleId, operation.orderId)}:${operation.operatingDate}`,
    train,
    sortMinutes: scheduled?.sortMinutes ?? Number.MAX_SAFE_INTEGER,
  };
}

export async function scrapePolandTrains(
  stationId: string,
  type: PolandBoardType = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.PLK_API_KEY as string | undefined;
  if (!apiKey) {
    throw new ScraperError("Polish train data source is not configured.", 500);
  }

  const stationNumber = toPolandStationNumber(stationId);
  const operationsUrl = buildPolandUrl("/operations", {
    stations: stationNumber,
    withPlanned: true,
    pageSize: TRAIN_LIMIT,
  });

  const { response: operationsResponse, fetchMs: operationsFetchMs } = await fetchWithTimeout(
    operationsUrl,
    "Polish",
    {
      headers: {
        ...POLAND_HEADERS,
        "X-API-Key": apiKey,
      },
    },
  );

  const operationsData: PolandOperationResponse = await operationsResponse.json();
  const operations = operationsData.trains ?? [];
  const stationOperations = operations.filter((operation) => {
    const stop = operation.stations?.find((item) => item.stationId === stationNumber);
    return shouldIncludeTrain(operation, stop, type);
  });

  if (stationOperations.length === 0) {
    return {
      trains: [],
      info: null,
      timing: { fetchMs: operationsFetchMs },
    };
  }

  const seen = new Set<string>();

  const trains = stationOperations
    .map((operation) => mapTrain(operation, stationNumber, type))
    .filter((entry): entry is MappedTrain => entry !== null)
    .sort((a, b) => a.sortMinutes - b.sortMinutes)
    .filter((entry) => {
      if (seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    })
    .slice(0, TRAIN_LIMIT)
    .map((entry) => entry.train);

  return {
    trains,
    info: null,
    timing: { fetchMs: operationsFetchMs },
  };
}
