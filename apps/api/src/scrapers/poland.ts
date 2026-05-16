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
const POLAND_RAW_CACHE_TTL_MS = 15_000;

const POLAND_CARRIERS: Record<string, string> = {
  IC: "PKP Intercity",
  PR: "POLREGIO",
  KM: "KM",
  KD: "KD",
  KS: "KS",
  KW: "KW",
  KMŁ: "KMŁ",
  ŁKA: "ŁKA",
  SKMT: "SKM",
  SKM_3M: "SKM",
  SKM: "SKM",
  WKD: "Warszawska Kolej Dojazdowa",
  AR: "Arriva",
  RP: "Railpolonia",
  LEO: "Leo Express",
  "Leo Express": "Leo Express",
  RJ: "RegioJet",
  ODEG: "ODEG",
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

interface PolandScheduleResponse {
  routes?: PolandScheduleRoute[] | null;
  dictionaries?: {
    stations?: Record<string, { id: number; name: string }> | null;
  } | null;
}

interface PolandScheduleRoute {
  scheduleId: number;
  orderId: number;
  name?: string | null;
  carrierCode?: string | null;
  nationalNumber?: string | null;
  commercialCategorySymbol?: string | null;
  stations?: PolandScheduleStop[] | null;
}

interface PolandScheduleStop {
  stationId: number;
  orderNumber: number;
  arrivalTrainNumber?: string | null;
  arrivalPlatform?: string | null;
  arrivalCommercialCategory?: string | null;
  departureTrainNumber?: string | null;
  departurePlatform?: string | null;
  departureCommercialCategory?: string | null;
}

interface ParsedTimeSpan {
  display: string;
  sortTime: number;
}

interface MappedTrain {
  key: string;
  train: Train;
  sortTime: number;
}

interface PolandRawData {
  operationsData: PolandOperationResponse;
  schedulesData: PolandScheduleResponse;
  fetchMs: number;
}

interface PolandRawCacheEntry {
  expiresAt: number;
  promise: Promise<PolandRawData>;
}

const rawDataCache = new Map<number, PolandRawCacheEntry>();

function toPolandStationNumber(stationId: string): number {
  const match = stationId.match(/^PL(\d+)$/);
  if (!match) {
    throw new ScraperError("Unknown Polish station.", 404);
  }
  return Number(match[1]);
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
    sortTime: timestamp,
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

  const plannedTime = getPlannedEventTime(stop, type);
  const actualTime = getActualEventTime(stop, type);
  if (!plannedTime && !actualTime) return false;
  if (stop.isCancelled) return true;

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
  schedule: PolandScheduleRoute | undefined,
  stationDict: Record<string, { id: number; name: string }>,
): MappedTrain | null {
  const operationStop = operation.stations?.find((stop) => stop.stationId === currentStationId);
  if (!shouldIncludeTrain(operation, operationStop, type)) return null;

  const scheduled = getOperationPlannedTime(operationStop, type);
  const actual = getActualEventTime(operationStop, type);
  const scheduleStop = schedule?.stations?.find((stop) => stop.stationId === currentStationId);

  const trainNumber =
    (type === "departures"
      ? scheduleStop?.departureTrainNumber
      : scheduleStop?.arrivalTrainNumber) ??
    schedule?.nationalNumber ??
    String(operation.trainOrderId);

  const category =
    (type === "departures"
      ? scheduleStop?.departureCommercialCategory
      : scheduleStop?.arrivalCommercialCategory) ??
    schedule?.commercialCategorySymbol ??
    null;

  const platform =
    (type === "departures" ? scheduleStop?.departurePlatform : scheduleStop?.arrivalPlatform) ??
    null;

  const endpointName = getRouteEndpointName(schedule, currentStationId, type, stationDict);

  const brand = schedule?.carrierCode ? (POLAND_CARRIERS[schedule.carrierCode] ?? null) : null;

  const train: Train = {
    brand,
    category,
    trainNumber,
    ...(type === "departures"
      ? endpointName
        ? { destination: endpointName }
        : {}
      : endpointName
        ? { origin: endpointName }
        : {}),
    scheduledTime: scheduled?.display ?? formatTime(actual, POLAND_TIMEZONE),
    delay: getDelay(operationStop, type),
    platform,
    status: getStatus(operationStop, type),
    info: getTrainInfo(operation, operationStop),
  };

  return {
    key: `${routeKey(operation.scheduleId, operation.orderId)}:${operation.operatingDate}`,
    train,
    sortTime: scheduled?.sortTime ?? Number.MAX_SAFE_INTEGER,
  };
}

function getRouteEndpointName(
  schedule: PolandScheduleRoute | undefined,
  currentStationId: number,
  type: PolandBoardType,
  stationDict: Record<string, { id: number; name: string }>,
): string | null {
  const stops = schedule?.stations;
  if (!stops || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.orderNumber - b.orderNumber);
  const endpoint = type === "departures" ? sorted[sorted.length - 1] : sorted[0];
  if (!endpoint || endpoint.stationId === currentStationId) return null;

  return stationDict[String(endpoint.stationId)]?.name ?? null;
}

async function fetchPolandRawData(stationNumber: number, apiKey: string): Promise<PolandRawData> {
  const operationsUrl = buildPolandUrl("/operations", {
    stations: stationNumber,
    withPlanned: true,
    pageSize: TRAIN_LIMIT,
  });
  const schedulesUrl = buildPolandUrl("/schedules", {
    stations: stationNumber,
    fullRoute: true,
    dictionaries: true,
  });

  const headers = { ...POLAND_HEADERS, "X-API-Key": apiKey };

  const [operationsResult, schedulesResult] = await Promise.all([
    fetchWithTimeout(operationsUrl, "Polish", { headers }),
    fetchWithTimeout(schedulesUrl, "Polish", { headers }),
  ]);

  const operationsData: PolandOperationResponse = await operationsResult.response.json();
  const schedulesData: PolandScheduleResponse = await schedulesResult.response.json();
  const fetchMs = Math.max(operationsResult.fetchMs, schedulesResult.fetchMs);

  return { operationsData, schedulesData, fetchMs };
}

function getCachedPolandRawData(stationNumber: number, apiKey: string): Promise<PolandRawData> {
  const now = Date.now();
  const cached = rawDataCache.get(stationNumber);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchPolandRawData(stationNumber, apiKey).catch((error) => {
    rawDataCache.delete(stationNumber);
    throw error;
  });

  rawDataCache.set(stationNumber, {
    expiresAt: now + POLAND_RAW_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

export async function scrapePolandTrains(
  stationId: string,
  type: PolandBoardType = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const stationNumber = toPolandStationNumber(stationId);
  const apiKey = env?.PLK_API_KEY as string | undefined;
  if (!apiKey) {
    throw new ScraperError("Polish train data source is not configured.", 500);
  }

  const { operationsData, schedulesData, fetchMs } = await getCachedPolandRawData(
    stationNumber,
    apiKey,
  );

  const scheduleMap = new Map<string, PolandScheduleRoute>();
  for (const route of schedulesData.routes ?? []) {
    scheduleMap.set(routeKey(route.scheduleId, route.orderId), route);
  }
  const stationDict = schedulesData.dictionaries?.stations ?? {};

  const operations = operationsData.trains ?? [];
  const stationOperations = operations.filter((operation) => {
    const stop = operation.stations?.find((item) => item.stationId === stationNumber);
    return shouldIncludeTrain(operation, stop, type);
  });

  if (stationOperations.length === 0) {
    return {
      trains: [],
      info: null,
      timing: { fetchMs },
    };
  }

  const seen = new Set<string>();

  const trains = stationOperations
    .map((operation) =>
      mapTrain(
        operation,
        stationNumber,
        type,
        scheduleMap.get(routeKey(operation.scheduleId, operation.orderId)),
        stationDict,
      ),
    )
    .filter((entry): entry is MappedTrain => entry !== null)
    .sort((a, b) => a.sortTime - b.sortTime)
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
    timing: { fetchMs },
  };
}
