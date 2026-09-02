import type { Train } from "@repo/data";

import {
  STATUS_WINDOW_MS,
  ScraperError,
  statusFromWindow,
  stripCountryPrefix,
  type ScrapeResult,
} from "./core";
import { fetchJsonWithTimeout } from "./fetch";

const DEPARTURE_BOARD_URL = "https://cdt.hafas.de/opendata/apiserver/departureBoard";
const LUXEMBOURG_TIMEZONE = "Europe/Luxembourg";
const TRAIN_LIMIT = 24;
const RECENT_DEPARTURE_MINUTES = 5;

interface LuxembourgScraperEnv extends Record<string, unknown> {
  MOBILITEIT_API_KEY: string;
}

interface MobiliteitNote {
  key?: string;
  type?: string;
  value?: string;
  txtN?: string;
  txtL?: string;
  txtS?: string;
}

interface MobiliteitProduct {
  name?: string;
  displayNumber?: string;
  num?: string;
  line?: string;
  catOut?: string;
  operatorCode?: string;
  operator?: string;
  operatorInfo?: {
    name?: string;
    nameS?: string;
  };
}

interface MobiliteitDeparture {
  JourneyStatus?: string;
  ProductAtStop?: MobiliteitProduct;
  Notes?: { Note?: MobiliteitNote | MobiliteitNote[] };
  name?: string;
  time?: string;
  date?: string;
  rtTime?: string;
  rtDate?: string;
  track?: string;
  rtTrack?: string;
  platform?: { text?: string };
  rtPlatform?: { text?: string };
  direction?: string;
  reachable?: boolean;
  cancelled?: boolean;
  partCancelled?: boolean;
}

interface MobiliteitDepartureBoard {
  Departure?: MobiliteitDeparture[];
  errorCode?: string;
  errorText?: string;
}

interface MappedDeparture {
  train: Train;
  scheduledMinutes: number;
  quality: number;
}

function departureKey({ train }: MappedDeparture): string {
  return `${train.trainNumber}|${train.scheduledTime}|${train.destination ?? ""}`;
}

function mergeDuplicateDepartures(
  first: MappedDeparture,
  second: MappedDeparture,
): MappedDeparture {
  const primary = second.quality > first.quality ? second : first;
  const secondary = primary === first ? second : first;
  const info = [...new Set([primary.train.info, secondary.train.info].filter(Boolean))].join(" · ");

  return {
    ...primary,
    train: {
      ...primary.train,
      brand: primary.train.brand ?? secondary.train.brand,
      category: primary.train.category ?? secondary.train.category,
      platform: primary.train.platform ?? secondary.train.platform,
      info: info || null,
    },
  };
}

function dedupeDepartures(departures: MappedDeparture[]): Train[] {
  const byService = new Map<string, MappedDeparture>();

  for (const departure of departures) {
    const key = departureKey(departure);
    const existing = byService.get(key);
    byService.set(key, existing ? mergeDuplicateDepartures(existing, departure) : departure);
  }

  return [...byService.values()]
    .sort((a, b) => a.scheduledMinutes - b.scheduledMinutes || b.quality - a.quality)
    .slice(0, TRAIN_LIMIT)
    .map(({ train }) => train);
}

function hasMobiliteitApiKey(
  env: Record<string, unknown> | undefined,
): env is LuxembourgScraperEnv {
  return typeof env?.MOBILITEIT_API_KEY === "string" && env.MOBILITEIT_API_KEY.length > 0;
}

function parseDate(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTime(value: string | undefined) {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function toComparableMinutes(date: string | undefined, time: string | undefined): number | null {
  const dateParts = parseDate(date);
  const timeParts = parseTime(time);
  if (!dateParts || !timeParts) return null;

  return (
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hour, timeParts.minute) /
    60_000
  );
}

function currentComparableMinutes(): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: LUXEMBOURG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  const { year, month, day, hour, minute } = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new ScraperError("Unable to determine the current time in Luxembourg.", 500);
  }

  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

function boardTime(value: string | undefined): string {
  const parts = parseTime(value);
  return parts
    ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
    : "--:--";
}

function asNotes(value: MobiliteitNote | MobiliteitNote[] | undefined): MobiliteitNote[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function departureInfo(departure: MobiliteitDeparture): string | null {
  const messages = asNotes(departure.Notes?.Note)
    .filter((note) => note.type === "R" || note.key?.toLowerCase().includes("cancel"))
    .map((note) => note.txtN ?? note.txtL ?? note.value ?? note.txtS)
    .filter((message): message is string => Boolean(message?.trim()));

  if (departure.JourneyStatus === "A") messages.unshift("Additional service");
  return [...new Set(messages)].slice(0, 3).join(" · ") || null;
}

function mapDeparture(departure: MobiliteitDeparture, nowMinutes: number): MappedDeparture | null {
  const scheduledMinutes = toComparableMinutes(departure.date, departure.time);
  if (scheduledMinutes === null) return null;

  const actualMinutes =
    toComparableMinutes(departure.rtDate ?? departure.date, departure.rtTime) ?? scheduledMinutes;
  const cancelled =
    departure.cancelled === true ||
    ["C", "CANCELLED"].includes(departure.JourneyStatus?.toUpperCase() ?? "");

  if (!cancelled && actualMinutes < nowMinutes - RECENT_DEPARTURE_MINUTES) return null;

  const product = departure.ProductAtStop;
  const category = product?.catOut ?? product?.line ?? null;
  const trainNumber =
    product?.displayNumber ?? product?.num ?? product?.name ?? departure.name ?? category ?? "—";
  const actualTimeMs = actualMinutes * 60_000;

  return {
    scheduledMinutes,
    quality:
      (cancelled ? 4 : 0) + (departure.rtTime ? 2 : 0) + (departure.JourneyStatus === "A" ? 1 : 0),
    train: {
      brand:
        product?.operatorCode ??
        product?.operatorInfo?.nameS ??
        product?.operatorInfo?.name ??
        product?.operator ??
        null,
      category,
      trainNumber,
      destination: departure.direction,
      scheduledTime: boardTime(departure.time),
      delay: cancelled ? null : actualMinutes - scheduledMinutes,
      platform:
        departure.rtTrack ??
        departure.rtPlatform?.text ??
        departure.track ??
        departure.platform?.text ??
        null,
      status: cancelled
        ? "cancelled"
        : statusFromWindow(actualTimeMs, nowMinutes * 60_000, STATUS_WINDOW_MS, "departures"),
      info: departureInfo(departure),
    },
  };
}

export async function scrapeLuxembourgTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  if (type === "arrivals") {
    throw new ScraperError(
      "Live arrivals are not available from the Luxembourg transport data provider.",
      501,
    );
  }

  if (!hasMobiliteitApiKey(env)) {
    throw new ScraperError("Luxembourg live data is not configured.", 500);
  }

  const providerStationId = stripCountryPrefix(stationId);
  const url = new URL(DEPARTURE_BOARD_URL);
  url.search = new URLSearchParams({
    accessId: env.MOBILITEIT_API_KEY,
    id: providerStationId,
    format: "json",
    lang: "en",
    duration: "120",
    maxJourneys: String(TRAIN_LIMIT),
    type: "DEP",
    rtMode: "SERVER_DEFAULT",
  }).toString();
  const { data, fetchMs } = await fetchJsonWithTimeout<MobiliteitDepartureBoard>(
    url.toString(),
    "Luxembourg",
  );

  const departures = data.Departure === undefined ? [] : data.Departure;

  if (data.errorCode || !Array.isArray(departures)) {
    throw new ScraperError(
      "The Luxembourg transport data source returned an invalid response.",
      502,
      { fetchMs },
    );
  }

  const nowMinutes = currentComparableMinutes();
  const mapped = departures.map((departure) => mapDeparture(departure, nowMinutes)).filter(
    (departure): departure is MappedDeparture => departure !== null,
  );
  const trains = dedupeDepartures(mapped);

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
