import type { Train } from "@repo/data";
import { stationById } from "@repo/data/stations";

import {
  STATUS_WINDOW_MS,
  ScraperError,
  formatTime,
  statusFromWindow,
  stripCountryPrefix,
  type ScrapeResult,
} from "./core";
import { fetchJsonWithTimeout } from "./fetch";

// Undocumented OpenTripPlanner 2 endpoint behind the MÁVPlusz journey planner.
const MAVPLUSZ_GRAPHQL_URL = "https://mavplusz.hu/otp2-backend/otp/routers/default/index/graphql";
const HUNGARY_TIMEZONE = "Europe/Budapest";
const REGION_LABEL = "Hungarian";
const TRAIN_LIMIT = 24;
const RECENT_TRAIN_SECONDS = 5 * 60;
const HOUR_SECONDS = 60 * 60;

// OTP's numberOfDepartures caps rows per route pattern, not in total, so the
// payload is bounded by timeRange. Busy Budapest termini fill the board in a
// couple of hours; rural halts need most of a day.
const TIME_RANGE_BY_IMPORTANCE: Record<number, number> = {
  1: 3 * HOUR_SECONDS,
  2: 4 * HOUR_SECONDS,
  3: 8 * HOUR_SECONDS,
  4: 12 * HOUR_SECONDS,
};

const BOARD_QUERY = `query Board($id: String!, $start: Long!, $range: Int!, $n: Int!) {
  stop(id: $id) {
    stoptimesWithoutPatterns(startTime: $start, timeRange: $range, numberOfDepartures: $n, omitNonPickups: false, omitCanceled: false) {
      scheduledArrival realtimeArrival arrivalDelay
      scheduledDeparture realtimeDeparture departureDelay
      realtime realtimeState serviceDay pickupType dropoffType headsign
      stop { platformCode }
      trip {
        gtfsId tripShortName
        route { longName mode agency { gtfsId } }
        departureStoptime { stop { name } }
        alerts { alertHeaderText alertDescriptionText effectiveEndDate }
      }
    }
  }
}`;

// Feed "1" agency ids. Only operators whose trains call at Hungarian stations
// are listed; anything else stays unbranded rather than guessed.
const AGENCY_BRANDS: Record<string, string> = {
  "1:198": "MÁV",
  "1:1164": "MÁV",
  // Gyermekvasút: the Budapest Children's Railway, run by MÁV.
  "1:1663": "MÁV",
  "1:134": "GYSEV",
  "1:204": "OBB",
  "1:209": "PKP Intercity",
  "1:197": "ČD",
  "1:196": "CFR Călători",
  "1:120": "UZ",
};

// Agencies whose trip numbers are the Hungarian train numbers; through-car
// portions of foreign railways carry prefixed numbers (10476, 40347).
const HOME_AGENCIES = new Set(["1:198", "1:1164", "1:1663", "1:134"]);

// Same train number at the same minute appears under several products
// (e.g. "706 NAPFÉNY gyorsvonat" and "706 NAPFÉNY InterCity"). Keep the
// most specific product.
const CATEGORY_RANK: Record<string, number> = {
  RJX: 6,
  RJ: 6,
  EC: 5,
  EN: 5,
  IC: 4,
  IR: 3,
  Ex: 3,
  Gy: 2,
  S: 1,
  Sz: 0,
};

const CATEGORY_ALIASES: Record<string, string> = {
  rjx: "RJX",
  rj: "RJ",
};

type PickupDropoffType = "SCHEDULED" | "NONE" | "CALL_AGENCY" | "COORDINATE_WITH_DRIVER";
type RealtimeState = "SCHEDULED" | "UPDATED" | "CANCELED" | "ADDED" | "MODIFIED";

interface OtpStoptime {
  scheduledArrival: number | null;
  realtimeArrival: number | null;
  arrivalDelay: number | null;
  scheduledDeparture: number | null;
  realtimeDeparture: number | null;
  departureDelay: number | null;
  realtime: boolean | null;
  realtimeState: RealtimeState | null;
  serviceDay: number | null;
  pickupType: PickupDropoffType | null;
  dropoffType: PickupDropoffType | null;
  headsign: string | null;
  stop: { platformCode: string | null } | null;
  trip: {
    gtfsId: string;
    tripShortName: string | null;
    route: {
      longName: string | null;
      mode: string | null;
      agency: { gtfsId: string } | null;
    } | null;
    departureStoptime: { stop: { name: string | null } | null } | null;
    alerts: OtpAlert[] | null;
  } | null;
}

interface OtpAlert {
  alertHeaderText: string | null;
  alertDescriptionText: string | null;
  effectiveEndDate: number | null;
}

interface OtpBoardResponse {
  data?: {
    stop: { stoptimesWithoutPatterns: OtpStoptime[] | null } | null;
  } | null;
  errors?: { message?: string }[];
}

interface MappedTrain {
  train: Train;
  scheduledSeconds: number;
  categoryRank: number;
  hasRealtime: boolean;
  agencyId: string;
  /** Named-train parts, e.g. ["DACIA", "RUTHENIA"] for "40347 DACIA - RUTHENIA gyorsvonat". */
  names: string[];
  origin: string | null;
  destination: string | null;
  alerts: string[];
}

const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/gi;
const HTML_ELEMENT_REGEX = /<([a-z][a-z0-9]*)\b[^>]*>[^<]*<\/\1>/gi;
const HTML_ENTITY_REGEX = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntity(_match: string, entity: string): string {
  const lower = entity.toLowerCase();
  if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
  if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
  return NAMED_ENTITIES[lower] ?? "";
}

/** Strips markup and entities from upstream labels; returns null when nothing is left. */
function cleanLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(HTML_TAG_REGEX, " ")
    .replace(HTML_ENTITY_REGEX, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function sourceStopId(stationId: string): string {
  return `1:00${stripCountryPrefix(stationId)}_0`;
}

function timeRangeFor(stationId: string): number {
  const importance = stationById.get(stationId)?.importance ?? 4;
  return TIME_RANGE_BY_IMPORTANCE[importance] ?? TIME_RANGE_BY_IMPORTANCE[4]!;
}

function parseCategory(routeLongName: string | null): string | null {
  // Icon-font spans (e.g. <span class="MNR2007">&#473;</span>) are glyphs, not text.
  const token = cleanLabel(routeLongName?.replace(HTML_ELEMENT_REGEX, " "))?.split(" ")[0];
  if (!token) return null;
  return CATEGORY_ALIASES[token.toLowerCase()] ?? token;
}

/**
 * Names the trip carries, from "476 METROPOL EuroNight" or "40347 DACIA - RUTHENIA
 * gyorsvonat": upper-case words after the number, before the mixed-case product.
 * Joined trains list each part. Route longNames list every train on the route.
 */
function parseTrainNames(tripShortName: string | null): string[] {
  const words = cleanLabel(tripShortName)?.split(" ").slice(1) ?? [];
  const nameEnd = words.findIndex((word) => word !== word.toLocaleUpperCase("hu"));
  return words
    .slice(0, nameEnd === -1 ? undefined : nameEnd)
    .join(" ")
    .split(/\s+-\s+|\//)
    .map((name) => name.trim())
    .filter((name) => /\p{L}/u.test(name));
}

function parseAlerts(alerts: OtpAlert[] | null | undefined, nowMs: number): string[] {
  const texts = (alerts ?? [])
    .filter((alert) => alert.effectiveEndDate === null || alert.effectiveEndDate * 1000 >= nowMs)
    .map((alert) =>
      cleanLabel(alert.alertDescriptionText ?? alert.alertHeaderText)?.replace(/[;:]$/, ""),
    )
    .filter((text): text is string => Boolean(text));
  return [...new Set(texts)];
}

function categoryRank(category: string | null): number {
  if (!category) return -1;
  // Suburban lines (S70, Z30, G43) rank with plain stopping trains.
  return CATEGORY_RANK[category] ?? CATEGORY_RANK[category.replace(/\d+$/, "")] ?? 1;
}

function parseTrainNumber(stoptime: OtpStoptime): string {
  const shortName = cleanLabel(stoptime.trip?.tripShortName);
  const number = shortName?.match(/^\d+/)?.[0];
  if (number) return number;
  return shortName ?? stoptime.trip?.gtfsId.replace(/^\d+:/, "") ?? "—";
}

function isRequestedDirection(stoptime: OtpStoptime, type: "arrivals" | "departures"): boolean {
  return type === "departures" ? stoptime.pickupType !== "NONE" : stoptime.dropoffType !== "NONE";
}

function mapStoptime(
  stoptime: OtpStoptime,
  type: "arrivals" | "departures",
  nowMs: number,
): MappedTrain | null {
  if (stoptime.trip?.route?.mode !== "RAIL") return null;
  if (!isRequestedDirection(stoptime, type)) return null;

  const isDeparture = type === "departures";
  const scheduledOffset = isDeparture ? stoptime.scheduledDeparture : stoptime.scheduledArrival;
  const realtimeOffset = isDeparture ? stoptime.realtimeDeparture : stoptime.realtimeArrival;
  const delaySeconds = isDeparture ? stoptime.departureDelay : stoptime.arrivalDelay;
  const { serviceDay } = stoptime;

  if (serviceDay === null || scheduledOffset === null) return null;

  // serviceDay is the Unix time of the service date's local midnight (noon - 12h,
  // so DST days stay correct) and offsets may exceed 24h for after-midnight calls.
  const scheduledSeconds = serviceDay + scheduledOffset;
  const cancelled = stoptime.realtimeState === "CANCELED";
  const hasRealtime = stoptime.realtime === true && !cancelled;
  const actualSeconds =
    hasRealtime && realtimeOffset !== null ? serviceDay + realtimeOffset : scheduledSeconds;

  if (!cancelled && actualSeconds * 1000 < nowMs - RECENT_TRAIN_SECONDS * 1000) return null;

  const category = parseCategory(stoptime.trip.route.longName);
  const agencyId = stoptime.trip.route.agency?.gtfsId ?? "";
  const origin = cleanLabel(stoptime.trip.departureStoptime?.stop?.name);
  const destination = cleanLabel(stoptime.headsign);
  const place = isDeparture
    ? { destination: destination ?? undefined }
    : { origin: origin ?? undefined };

  return {
    scheduledSeconds,
    categoryRank: categoryRank(category),
    hasRealtime,
    agencyId,
    names: parseTrainNames(stoptime.trip.tripShortName),
    origin,
    destination,
    alerts: parseAlerts(stoptime.trip.alerts, nowMs),
    train: {
      brand: AGENCY_BRANDS[agencyId] ?? null,
      category,
      trainNumber: parseTrainNumber(stoptime),
      ...place,
      scheduledTime: formatTime(new Date(scheduledSeconds * 1000).toISOString(), HUNGARY_TIMEZONE),
      // realtime:false means no live information, not "on time".
      delay: hasRealtime && delaySeconds !== null ? Math.round(delaySeconds / 60) : null,
      platform: cleanLabel(stoptime.stop?.platformCode),
      status: cancelled
        ? "cancelled"
        : statusFromWindow(actualSeconds * 1000, nowMs, STATUS_WINDOW_MS, type),
      info: null,
    },
  };
}

/**
 * One service can appear as several trips: the same number under two products,
 * or a named train with through-car portions under their own numbers (EN 476
 * METROPOL departs with 10476 to Praha and 40476 to Berlin). Portions share a
 * name and one end of the journey; opposite-direction trains share neither.
 */
function isSameService(a: MappedTrain, b: MappedTrain): boolean {
  if (a.train.trainNumber === b.train.trainNumber) return true;
  if (!a.names.some((name) => b.names.includes(name))) return false;
  return (
    (a.origin !== null && a.origin === b.origin) ||
    (a.destination !== null && a.destination === b.destination)
  );
}

function trainNumberValue(train: Train): number {
  return Number.parseInt(train.trainNumber, 10) || Number.MAX_SAFE_INTEGER;
}

/** Prefers the most specific product, then the main train over prefixed portions. */
function comparePrimary(a: MappedTrain, b: MappedTrain): number {
  return (
    b.categoryRank - a.categoryRank ||
    a.train.trainNumber.length - b.train.trainNumber.length ||
    Number(HOME_AGENCIES.has(b.agencyId)) - Number(HOME_AGENCIES.has(a.agencyId)) ||
    Number(b.hasRealtime) - Number(a.hasRealtime) ||
    trainNumberValue(a.train) - trainNumberValue(b.train)
  );
}

function mergeService(members: MappedTrain[], type: "arrivals" | "departures"): MappedTrain {
  const [primary, ...others] = [...members].sort(comparePrimary);
  if (!primary) throw new Error("Cannot merge an empty service");

  const live = primary.hasRealtime ? primary : (others.find((m) => m.hasRealtime) ?? primary);
  const place = (m: MappedTrain) => (type === "departures" ? m.destination : m.origin);
  const primaryPlace = place(primary);
  // Same-number rows of one agency are one train sold as two products, often
  // with the domestic one ending at the border; they continue nowhere else.
  const otherPlaces = [
    ...new Set(
      others
        .filter(
          (m) =>
            m.train.trainNumber !== primary.train.trainNumber || m.agencyId !== primary.agencyId,
        )
        .map(place)
        .filter((p): p is string => p !== null && p !== primaryPlace),
    ),
  ];
  const info = [...new Set(members.flatMap((m) => m.alerts))];
  if (otherPlaces.length > 0) {
    info.push(`${type === "departures" ? "Also to" : "Also from"} ${otherPlaces.join(", ")}`);
  }

  return {
    ...primary,
    train: {
      ...primary.train,
      platform: [primary, ...others].map((m) => m.train.platform).find((p) => p !== null) ?? null,
      delay: live.train.delay,
      status: primary.train.status === "cancelled" ? "cancelled" : live.train.status,
      info: info.join(" · ") || null,
    },
  };
}

function dedupeSortLimit(trains: MappedTrain[], type: "arrivals" | "departures"): Train[] {
  const servicesBySecond = new Map<number, MappedTrain[][]>();

  for (const mapped of trains) {
    const services = servicesBySecond.get(mapped.scheduledSeconds) ?? [];
    const [service, ...bridgedServices] = services.filter((members) =>
      members.some((member) => isSameService(member, mapped)),
    );
    if (service) {
      // A joined-train row can connect several previously separate services.
      for (const bridged of bridgedServices) {
        service.push(...bridged);
        services.splice(services.indexOf(bridged), 1);
      }
      service.push(mapped);
    } else services.push([mapped]);
    servicesBySecond.set(mapped.scheduledSeconds, services);
  }

  return [...servicesBySecond.values()]
    .flat()
    .map((members) => mergeService(members, type))
    .sort((a, b) => a.scheduledSeconds - b.scheduledSeconds || b.categoryRank - a.categoryRank)
    .slice(0, TRAIN_LIMIT)
    .map(({ train }) => train);
}

async function fetchBoard(variables: Record<string, string | number>) {
  try {
    return await fetchJsonWithTimeout<OtpBoardResponse>(MAVPLUSZ_GRAPHQL_URL, REGION_LABEL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: BOARD_QUERY, variables }),
    });
  } catch (error) {
    // MÁVPlusz answers a per-IP burst limit with "403 host limit achived" and
    // lifts it within about a minute; that is a temporary outage, not a ban.
    if (error instanceof ScraperError && error.statusCode === 403) {
      throw new ScraperError(
        "The Hungarian train data source is temporarily limiting requests. Please try again shortly.",
        503,
        error.timing,
        { cause: error, upstream: error.upstream },
      );
    }
    throw error;
  }
}

export async function scrapeHungaryTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const nowMs = Date.now();
  const { data, fetchMs } = await fetchBoard({
    id: sourceStopId(stationId),
    start: Math.floor(nowMs / 1000) - RECENT_TRAIN_SECONDS,
    range: timeRangeFor(stationId),
    n: TRAIN_LIMIT,
  });

  // GraphQL reports failures with HTTP 200 and an errors array.
  if (data.errors?.length) {
    throw new ScraperError(
      "The Hungarian train data source returned an error. Please try again.",
      502,
      { fetchMs },
      { cause: new Error(data.errors.map((error) => error.message).join("; ")) },
    );
  }

  const stop = data.data?.stop;
  if (stop === null) {
    throw new ScraperError("The Hungarian train data source does not know this station.", 404, {
      fetchMs,
    });
  }

  const stoptimes = stop?.stoptimesWithoutPatterns;
  if (!Array.isArray(stoptimes)) {
    throw new ScraperError("The Hungarian train data source returned an invalid response.", 502, {
      fetchMs,
    });
  }

  const mapped = stoptimes
    .map((stoptime) => mapStoptime(stoptime, type, nowMs))
    .filter((train): train is MappedTrain => train !== null);

  return {
    trains: dedupeSortLimit(mapped, type),
    info: null,
    timing: { fetchMs },
  };
}
