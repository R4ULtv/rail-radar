import type { Train } from "@repo/data";

import { fetchWithTimeout } from "./fetch";
import { ScraperError, type ScrapeResult } from "./index";

const REJSEPLANEN_BASE_URL = "https://www.rejseplanen.dk/api";
const DENMARK_TIMEZONE = "Europe/Copenhagen";
const TRAIN_LIMIT = 24;
const STATUS_WINDOW_MINUTES = 5;

const NON_RAIL_PRODUCT_TOKENS = ["bus", "metro", "letbane", "tram", "ferry", "taxi", "subway"];

type BoardType = "arrivals" | "departures";
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeBoardTime(value: string | null): string {
  const parts = parseTimeParts(value);
  if (!parts) return value ? normalizeWhitespace(value) : "--:--";
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function isCodeLikeText(value: string): boolean {
  const normalized = normalizeWhitespace(value);

  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^\d+(?:[.,]\d+)?$/.test(normalized)) return true;
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return true;
  if (/^PT[\dHMS]+$/i.test(normalized)) return true;
  if (/^[0-9a-f]{6}$/i.test(normalized)) return true;
  if (/^A=\d@/i.test(normalized)) return true;
  if (/^text\.[a-z0-9_.-]+$/i.test(normalized)) return true;
  if (/^[A-Z]{2,4}$/.test(normalized)) return true;
  if (/^\d+(?:[.,]\d+)+(?:\/{1,3}[\d.,/]+)?$/.test(normalized)) return true;

  return false;
}

function extractPreferredString(
  value: unknown,
  preferredKeys: string[] = ["text", "#text", "value", "name"],
  depth = 0,
): string | null {
  if (depth > 4 || value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const normalized = normalizeWhitespace(String(value));
    return normalized || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractPreferredString(item, preferredKeys, depth + 1);
      if (extracted) return extracted;
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of preferredKeys) {
    if (!(key in value)) continue;

    const extracted = extractPreferredString(value[key], preferredKeys, depth + 1);
    if (extracted) return extracted;
  }

  for (const item of Object.values(value)) {
    if (typeof item === "string" || typeof item === "number") {
      const normalized = normalizeWhitespace(String(item));
      if (normalized) return normalized;
    }
  }

  return null;
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized ? [normalized] : [];
  }

  if (typeof value === "number") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => collectStringValues(item, depth + 1));
  }

  return [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function pickString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;

    const candidate = extractPreferredString(value);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function pickNestedName(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) {
          const nested = extractPreferredString(item, ["name", "text", "#text", "value"]);
          if (nested) return nested;
        }

        const direct = extractPreferredString(item, ["name", "text", "#text", "value"]);
        if (direct) return direct;
      }
      continue;
    }

    if (isRecord(value)) {
      const nested = extractPreferredString(value, ["name", "text", "#text", "value"]);
      if (nested) return nested;
    }

    const direct = extractPreferredString(value, ["name", "text", "#text", "value"]);
    if (direct) return direct;
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function parseDateParts(value: string | null): { year: number; month: number; day: number } | null {
  if (!value) return null;

  const normalized = value.trim();
  let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }

  match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (match) {
    return { year: 2000 + Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }

  return null;
}

function parseTimeParts(value: string | null): { hour: number; minute: number } | null {
  if (!value) return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function toComparableMinutes(dateValue: string | null, timeValue: string | null): number | null {
  const dateParts = parseDateParts(dateValue);
  const timeParts = parseTimeParts(timeValue);

  if (!dateParts || !timeParts) {
    return null;
  }

  return (
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hour, timeParts.minute) /
    60_000
  );
}

function getCurrentComparableMinutes(timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date());
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return (
    Date.UTC(
      Number(byType.year),
      Number(byType.month) - 1,
      Number(byType.day),
      Number(byType.hour),
      Number(byType.minute),
    ) / 60_000
  );
}

function getBoardRoot(payload: unknown, type: BoardType): JsonRecord | null {
  if (!isRecord(payload)) return null;

  const boardKey = type === "departures" ? "DepartureBoard" : "ArrivalBoard";
  const directBoard = payload[boardKey];

  if (isRecord(directBoard)) {
    return directBoard;
  }

  return payload;
}

function getProductRecords(entry: JsonRecord): JsonRecord[] {
  return [...asRecordArray(entry.ProductAtStop), ...asRecordArray(entry.Product)];
}

function getProductSignature(entry: JsonRecord): string {
  const productStrings = getProductRecords(entry).flatMap((product) =>
    collectStringValues(
      [
        product.name,
        product.internalName,
        product.catOut,
        product.catIn,
        product.catOutS,
        product.catOutL,
        product.line,
        product.operator,
        product.operatorInfo,
      ].filter((value) => value != null),
    ),
  );

  return normalizeWhitespace(
    uniqueStrings([...collectStringValues(entry.name), ...productStrings])
      .join(" ")
      .toLowerCase(),
  );
}

function isRailEntry(entry: JsonRecord): boolean {
  const signature = getProductSignature(entry);
  if (!signature) return true;

  return !NON_RAIL_PRODUCT_TOKENS.some((token) => signature.includes(token));
}

function getBrand(entry: JsonRecord): string | null {
  const directOperators = uniqueStrings(
    getProductRecords(entry)
      .map((product) => {
        return (
          extractPreferredString(product.operatorInfo, ["text", "#text", "value", "name"]) ??
          extractPreferredString(product.operator, ["text", "#text", "value", "name"]) ??
          extractPreferredString(product.name, ["text", "#text", "value", "name"]) ??
          extractPreferredString(product.internalName, ["text", "#text", "value", "name"])
        );
      })
      .filter((value): value is string => Boolean(value)),
  );

  for (const operator of directOperators) {
    const normalized = normalizeWhitespace(operator);
    const lower = normalized.toLowerCase();

    if (lower.includes("s-tog") || lower.includes("s-train")) return "DSB";
    if (lower.includes("øresund") || lower.includes("oresund")) return "Øresundståg";
    if (lower.includes("skånetrafiken") || lower.includes("skanetrafiken")) return "Skånetrafiken";
    if (lower.includes("gocollective") || lower.includes("arriva")) return "Arriva";
    if (lower.includes("nordjyske jernbaner") || lower === "nj") return "NJ";
    if (lower.includes("lokaltog")) return "Lokaltog";
    if (lower.includes("midtjyske jernbaner")) return "Midtjyske Jernbaner";
    if (lower.includes("snälltåg") || lower.includes("snalltag")) return "Snälltåget";
    if (lower === "sj" || lower.includes(" sj ")) return "SJ";
    if (lower.startsWith("dsb")) return "DSB";
  }

  for (const product of getProductRecords(entry)) {
    const operator =
      extractPreferredString(product.operatorInfo, ["text", "#text", "value", "name"]) ??
      extractPreferredString(product.operator, ["text", "#text", "value", "name"]);
    if (operator) {
      return operator;
    }
  }

  const signature = getProductSignature(entry);

  if (signature.includes("s-tog")) return "DSB";
  if (signature.includes("øresund") || signature.includes("oresund")) return "Øresundståg";
  if (signature.includes("skånetrafiken") || signature.includes("skanetrafiken")) {
    return "Skånetrafiken";
  }
  if (signature.includes("gocollective") || signature.includes("arriva")) return "Arriva";
  if (signature.includes("nordjyske jernbaner") || /\bnj\b/.test(signature)) return "NJ";
  if (signature.includes("lokaltog")) return "Lokaltog";
  if (signature.includes("midtjyske jernbaner")) return "Midtjyske Jernbaner";
  if (signature.includes("dsb")) return "DSB";
  if (signature.includes("snälltåg")) return "Snälltåget";
  if (signature.includes("sj")) return "SJ";
  if (signature.includes("vy")) return "Vy";
  if (signature.includes("db")) return "DB";

  return null;
}

function getCategory(entry: JsonRecord): string | null {
  for (const product of getProductRecords(entry)) {
    const categoryCandidates = [
      extractPreferredString(product.catOutS, ["text", "#text", "value", "name"]),
      extractPreferredString(product.catOut, ["text", "#text", "value", "name"]),
      extractPreferredString(product.catIn, ["text", "#text", "value", "name"]),
      extractPreferredString(product.catOutL, ["text", "#text", "value", "name"]),
      extractPreferredString(product.name, ["text", "#text", "value", "name"]),
      extractPreferredString(product.internalName, ["text", "#text", "value", "name"]),
    ];

    const category = categoryCandidates.find((value) => value && !isCodeLikeText(value)) ?? null;
    if (category) {
      return category;
    }
  }

  const signature = getProductSignature(entry);
  if (signature.includes("s-tog")) return "S";

  return null;
}

function parseTrainNumber(name: string | null): string | null {
  if (!name) return null;

  const match = name.match(/([A-Za-z]?\d+[A-Za-z]?)$/);
  if (match) {
    return match[1] ?? null;
  }

  const tokens = normalizeWhitespace(name).split(" ");
  return tokens[tokens.length - 1] ?? null;
}

function getTrainNumber(entry: JsonRecord): string {
  for (const product of getProductRecords(entry)) {
    const value = pickString(product, "displayNumber", "num");
    if (value) {
      return value;
    }
  }

  const fromName = parseTrainNumber(pickString(entry, "name"));
  if (fromName && /\d/.test(fromName)) {
    return fromName;
  }

  for (const product of getProductRecords(entry)) {
    const line = pickString(product, "line");
    if (line) {
      return line;
    }
  }

  return fromName ?? pickString(entry, "name") ?? "Unknown";
}

function getDelay(entry: JsonRecord): number | null {
  const scheduledDate = pickString(entry, "date");
  const scheduledTime = pickString(entry, "time");
  const realtimeDate = pickString(entry, "rtDate") ?? scheduledDate;
  const realtimeTime = pickString(entry, "rtTime");

  const scheduledMinutes = toComparableMinutes(scheduledDate, scheduledTime);
  const realtimeMinutes = toComparableMinutes(realtimeDate, realtimeTime);

  if (scheduledMinutes == null || realtimeMinutes == null) {
    return null;
  }

  const diff = realtimeMinutes - scheduledMinutes;
  return diff > 0 ? diff : null;
}

function getStatus(entry: JsonRecord, type: BoardType): Train["status"] {
  if (toBoolean(entry.cancelled)) {
    return "cancelled";
  }

  const scheduledDate = pickString(entry, "date");
  const scheduledTime = pickString(entry, "time");
  const realtimeDate = pickString(entry, "rtDate") ?? scheduledDate;
  const realtimeTime = pickString(entry, "rtTime") ?? scheduledTime;
  const comparableMinutes = toComparableMinutes(realtimeDate, realtimeTime);

  if (comparableMinutes == null) {
    return null;
  }

  const now = getCurrentComparableMinutes(DENMARK_TIMEZONE);
  if (Math.abs(comparableMinutes - now) <= STATUS_WINDOW_MINUTES) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function collectHumanTexts(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number") {
    const normalized = normalizeWhitespace(String(value));
    return normalized && !isCodeLikeText(normalized) ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectHumanTexts(item, depth + 1));
  }

  if (!isRecord(value)) {
    return [];
  }

  const preferredTexts = ["text", "#text", "value", "subtitle", "header", "title", "name"]
    .filter((key) => key in value)
    .flatMap((key) => collectHumanTexts(value[key], depth + 1));

  if (preferredTexts.length > 0) {
    return preferredTexts;
  }

  return Object.entries(value).flatMap(([key, item]) => {
    if (
      [
        "id",
        "extId",
        "lon",
        "lat",
        "url",
        "icon",
        "cls",
        "rtTime",
        "rtDate",
        "time",
        "date",
      ].includes(key)
    ) {
      return [];
    }

    return collectHumanTexts(item, depth + 1);
  });
}

function getInfo(entry: JsonRecord): string | null {
  const noteText = uniqueStrings([
    ...collectHumanTexts(entry.Notes),
    ...collectHumanTexts(entry.Note),
    ...collectHumanTexts(entry.Messages),
    ...collectHumanTexts(entry.Message),
  ]).filter((value) => value.length > 1);

  return noteText.length > 0 ? noteText.slice(0, 3).join("; ") : null;
}

function getPlatform(entry: JsonRecord): string | null {
  const rawPlatform =
    extractPreferredString(entry.rtPlatform, ["text", "#text", "value", "track", "name"]) ??
    extractPreferredString(entry.platform, ["text", "#text", "value", "track", "name"]) ??
    extractPreferredString(entry.rtTrack, ["text", "#text", "value", "track", "name"]) ??
    extractPreferredString(entry.track, ["text", "#text", "value", "track", "name"]);

  if (!rawPlatform) return null;

  const normalized = normalizeWhitespace(rawPlatform);
  if (!normalized) return null;
  if (["PL", "TRACK"].includes(normalized.toUpperCase())) return null;

  return normalized;
}

function mapEntry(entry: JsonRecord, type: BoardType): Train {
  const train: Train = {
    brand: getBrand(entry),
    category: getCategory(entry),
    trainNumber: getTrainNumber(entry),
    scheduledTime: normalizeBoardTime(pickString(entry, "time")),
    delay: getDelay(entry),
    platform: getPlatform(entry),
    status: getStatus(entry, type),
    info: getInfo(entry),
  };

  if (type === "departures") {
    train.destination =
      pickString(entry, "direction") ??
      pickNestedName(entry, "DestinationStop", "Directions", "Direction", "Destination") ??
      undefined;
  } else {
    train.origin = pickNestedName(entry, "OriginStop") ?? pickString(entry, "origin") ?? undefined;
  }

  return train;
}

function getEntries(payload: unknown, type: BoardType): JsonRecord[] {
  const board = getBoardRoot(payload, type);
  if (!board) {
    throw new ScraperError("Invalid response from the Danish train data source.", 502);
  }

  const entryKey = type === "departures" ? "Departure" : "Arrival";
  const entries = asRecordArray(board[entryKey] ?? null);

  if (entries.length > 0) {
    return entries;
  }

  return asRecordArray((payload as JsonRecord)[entryKey] ?? null);
}

function toRejseplanenStationId(stationId: string): string {
  if (!/^DK\d{5}$/.test(stationId)) {
    throw new ScraperError(`Unknown Danish station ID: ${stationId}`, 400);
  }

  return `86${stationId.slice(2)}`;
}

function buildBoardUrl(stationId: string, type: BoardType): string {
  const endpoint = type === "departures" ? "departureBoard" : "arrivalBoard";
  const boardType = type === "departures" ? "DEP_STATION" : "ARR_STATION";
  const url = new URL(`${REJSEPLANEN_BASE_URL}/${endpoint}`);

  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("id", stationId);
  url.searchParams.set("type", boardType);
  url.searchParams.set("maxJourneys", String(TRAIN_LIMIT));

  return url.toString();
}

export async function scrapeDenmarkTrains(
  stationId: string,
  type: BoardType = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.REJSEPLANEN_API_KEY;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new ScraperError("Rejseplanen API key is not configured.", 500);
  }

  const rejseplanenStationId = toRejseplanenStationId(stationId);
  const { response, fetchMs } = await fetchWithTimeout(
    buildBoardUrl(rejseplanenStationId, type),
    "Danish",
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const payload = (await response.json()) as unknown;
  const entries = getEntries(payload, type);
  const trains = entries
    .filter((entry) => isRailEntry(entry))
    .map((entry) => mapEntry(entry, type))
    .filter((train, index, array) => {
      const key = `${train.trainNumber}-${train.scheduledTime}-${train.origin ?? train.destination ?? ""}`;
      return (
        index ===
        array.findIndex((candidate) => {
          const candidateKey = `${candidate.trainNumber}-${candidate.scheduledTime}-${candidate.origin ?? candidate.destination ?? ""}`;
          return candidateKey === key;
        })
      );
    })
    .slice(0, TRAIN_LIMIT);

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
