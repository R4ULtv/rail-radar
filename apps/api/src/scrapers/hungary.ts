import type { Train } from "@repo/data";

import {
  STATUS_WINDOW_MS,
  ScraperError,
  formatTime,
  statusFromWindow,
  stripCountryPrefix,
  type ScrapeResult,
} from "./core";
import { fetchJsonWithTimeout } from "./fetch";

// Undocumented station board behind MÁV's ticket shop (jegy.mav.hu). MÁVPlusz's
// journey planner refuses Cloudflare Workers outright, so it can't be used.
const MAV_TIMETABLE_URL = "https://jegy-a.mav.hu/IK_API_PROD/api/InformationApi/GetTimetable";
const HUNGARY_TIMEZONE = "Europe/Budapest";
const REGION_LABEL = "Hungarian";
const TRAIN_LIMIT = 24;
const RECENT_TRAIN_MS = 5 * 60 * 1000;
// Rows are listed by scheduled time from travelDate, so start early enough to keep
// delayed trains that have not left yet.
const LOOKBACK_MS = 30 * 60 * 1000;
// maxCount caps the rows of both directions together, and each row is about 8 KB.
// 80 rows cover the next 24 trains even at Budapest-Nyugati, the busiest station.
const ROW_LIMIT = 80;

// Each board ends with the last train of the service day.
const serviceDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: HUNGARY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const KIND_CATEGORIES: Record<string, string> = {
  "railjet xpress": "RJX",
  railjet: "RJ",
  euronight: "EN",
  eurocity: "EC",
  intercity: "IC",
  euroregio: "ER",
  interrégió: "IR",
  expresszvonat: "Ex",
  gyorsvonat: "Gy",
  sebesvonat: "Sebes",
  személyvonat: "Sz",
};

const REGIONAL_KINDS = new Set(["személyvonat", "sebesvonat"]);

// GYSEV's stations are numbered after its UIC company code (43), MÁV's after 55.
const GYSEV_STATION_PREFIX = "0043";

interface MavStation {
  name: string | null;
  code: string | null;
}

interface MavRow {
  code: string | null;
  start: string | null;
  arrive: string | null;
  actualOrEstimatedStart: string | null;
  actualOrEstimatedArrive: string | null;
  startTrack: string | null;
  endTrack: string | null;
  startStation: MavStation | null;
  endStation: MavStation | null;
  kind: { name: string | null } | null;
  /** Budapest suburban and regional line, e.g. S70 or IR85. */
  viszonylatiJel: { jel: string | null } | null;
  havarianInfok: {
    /** Disruption notices. */
    havariaInfo: string[] | null;
    /** Delay reason. */
    kesesiOk: string | null;
  } | null;
}

interface MavTimetableResponse {
  stationSchedulerDetails?: {
    departureScheduler?: MavRow[] | null;
    arrivalScheduler?: MavRow[] | null;
  } | null;
}

interface MappedTrain {
  train: Train;
  scheduledMs: number;
}

function clean(value: string | null | undefined): string | null {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function kindName(row: MavRow): string | null {
  return clean(row.kind?.name)?.toLocaleLowerCase("hu") ?? null;
}

function parseCategory(row: MavRow): string | null {
  const line = clean(row.viszonylatiJel?.jel);
  if (line) return line;
  const kind = kindName(row);
  return kind ? (KIND_CATEGORIES[kind] ?? clean(row.kind?.name)) : null;
}

/**
 * The source names no operator. MÁV runs Hungary's passenger trains except GYSEV's
 * regional services, which all start or end on GYSEV's own network.
 */
function parseBrand(row: MavRow): string {
  const kind = kindName(row);
  const onGysevNetwork = [row.startStation, row.endStation].some((station) =>
    station?.code?.startsWith(GYSEV_STATION_PREFIX),
  );
  return kind && REGIONAL_KINDS.has(kind) && onGysevNetwork ? "GYSEV" : "MÁV";
}

function parseInfo(row: MavRow, delay: number | null): string | null {
  const notices = (row.havarianInfok?.havariaInfo ?? []).map(clean);
  // The delay reason describes the train's current delay, so only show it when the
  // train is late here too; it may make up time with a longer stop.
  if (delay !== null && delay > 0) notices.push(clean(row.havarianInfok?.kesesiOk));
  const texts = notices.filter((text): text is string => Boolean(text));
  return [...new Set(texts)].join(" · ") || null;
}

function mapRow(row: MavRow, type: "arrivals" | "departures", nowMs: number): MappedTrain | null {
  // Rail replacement buses ("vonatpótló autóbusz") are listed alongside trains.
  if (kindName(row)?.includes("autóbusz")) return null;

  const isDeparture = type === "departures";
  const scheduledMs = Date.parse((isDeparture ? row.start : row.arrive) ?? "");
  if (!Number.isFinite(scheduledMs)) return null;

  // Only trains with live tracking carry an actual or estimated time.
  const liveMs = Date.parse(
    (isDeparture ? row.actualOrEstimatedStart : row.actualOrEstimatedArrive) ?? "",
  );
  const hasLive = Number.isFinite(liveMs);
  const actualMs = hasLive ? liveMs : scheduledMs;
  if (actualMs < nowMs - RECENT_TRAIN_MS) return null;

  const delay = hasLive ? Math.round((liveMs - scheduledMs) / 60_000) : null;
  const origin = clean(row.startStation?.name) ?? undefined;
  const destination = clean(row.endStation?.name) ?? undefined;

  return {
    scheduledMs,
    train: {
      brand: parseBrand(row),
      category: parseCategory(row),
      trainNumber: clean(row.code) ?? "—",
      ...(isDeparture ? { destination } : { origin }),
      scheduledTime: formatTime(new Date(scheduledMs).toISOString(), HUNGARY_TIMEZONE),
      delay,
      platform: clean(isDeparture ? row.startTrack : row.endTrack),
      status: statusFromWindow(actualMs, nowMs, STATUS_WINDOW_MS, type),
      info: parseInfo(row, delay),
    },
  };
}

function nextServiceDate(ms: number): string {
  const [year, month, day] = serviceDate.format(ms).split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

async function fetchBoard(stationId: string, travelDate: string, type: "arrivals" | "departures") {
  const { data, fetchMs } = await fetchJsonWithTimeout<MavTimetableResponse>(
    MAV_TIMETABLE_URL,
    REGION_LABEL,
    {
      method: "POST",
      // Train kinds are matched by their Hungarian names.
      headers: { "Content-Type": "application/json", Accept: "application/json", Language: "hu" },
      body: JSON.stringify({
        type: "StationInfo",
        // An ISO instant, or a bare date for the start of that day in Budapest.
        travelDate,
        stationNumberCode: `00${stripCountryPrefix(stationId)}`,
        minCount: "0",
        maxCount: String(ROW_LIMIT),
      }),
    },
  );

  const details = data?.stationSchedulerDetails;
  const departures = details?.departureScheduler;
  const arrivals = details?.arrivalScheduler;
  if (!Array.isArray(departures) || !Array.isArray(arrivals)) {
    throw new ScraperError("The Hungarian train data source returned an invalid response.", 502, {
      fetchMs,
    });
  }

  return {
    rows: type === "departures" ? departures : arrivals,
    // A short board means the service day ran out before the row limit.
    dayEnded: departures.length + arrivals.length < ROW_LIMIT,
    fetchMs,
  };
}

export async function scrapeHungaryTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const nowMs = Date.now();
  const startMs = nowMs - LOOKBACK_MS;
  const today = await fetchBoard(stationId, new Date(startMs).toISOString(), type);
  const mapRows = (rows: MavRow[]) =>
    rows
      .map((row) => mapRow(row, type, nowMs))
      .filter((train): train is MappedTrain => train !== null);

  const trains = mapRows(today.rows);
  let { fetchMs } = today;

  // Late in the day, carry on with the next service day's first trains.
  if (today.dayEnded && trains.length < TRAIN_LIMIT) {
    const tomorrow = await fetchBoard(stationId, nextServiceDate(startMs), type);
    trains.push(...mapRows(tomorrow.rows));
    fetchMs += tomorrow.fetchMs;
  }

  // After-midnight trains of one service day can reappear on the next day's board.
  const seen = new Set<string>();
  const board = trains
    .sort((a, b) => a.scheduledMs - b.scheduledMs)
    .filter(({ train, scheduledMs }) => {
      const key = `${train.trainNumber}|${scheduledMs}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TRAIN_LIMIT)
    .map(({ train }) => train);

  return { trains: board, info: null, timing: { fetchMs } };
}
