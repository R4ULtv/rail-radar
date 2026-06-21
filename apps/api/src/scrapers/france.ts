import type { Train } from "@repo/data";

import { ScraperError, type ScrapeResult } from "./index";
import { fetchWithTimeout } from "./fetch";

const SNCF_BASE_URL = "https://api.navitia.io/v1/coverage/sncf";
const PARIS_TZ = "Europe/Paris";
const RECENT_WINDOW_MS = 5 * 60 * 1000;
const TRAIN_LIMIT = 24;

// Convert FR station ID to its 8-digit UIC code (e.g. "FR686006" -> "87686006").
function convertFranceStationId(stationId: string): string {
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  return `87${numericPart}`;
}

// SNCF (Navitia) addresses stations as stop_area:SNCF:<UIC>. If SNCF changes
// the prefix this is the only line that needs to move.
function buildStopAreaId(stationId: string): string {
  return `stop_area:SNCF:${convertFranceStationId(stationId)}`;
}

function buildSncfUrl(stationId: string, arrivals: boolean, fromDatetime: string): string {
  const endpoint = arrivals ? "arrivals" : "departures";
  const stopArea = encodeURIComponent(buildStopAreaId(stationId));
  return (
    `${SNCF_BASE_URL}/stop_areas/${stopArea}/${endpoint}` +
    `?data_freshness=realtime&count=${TRAIN_LIMIT}&disable_geojson=true&from_datetime=${fromDatetime}`
  );
}

// Navitia response types (only the fields we use)
interface DisplayInformations {
  direction: string;
  network: string | null;
  commercial_mode: string | null;
  physical_mode: string | null;
  headsign: string | null;
  code: string | null;
  trip_short_name: string | null;
}

// Short category labels for trains with no line code (long-distance services).
const PHYSICAL_MODE_LABELS: Record<string, string> = {
  "Train grande vitesse": "TGV",
  "TER / Intercités": "TER",
  "RER / Transilien": "RER",
  "Navette ferrée": "Navette",
  Tramway: "Tram",
};

// SNCF's "sncf" coverage also serves replacement buses/coaches — keep rail only.
const NON_RAIL_MODES = new Set(["Bus", "Autocar", "Car", "Bike", "BikeSharingService"]);

// brand = operator/network; category = the line of the train (RER B, Transilien
// H, TER K13) when present, otherwise the service type (TGV, TER, …).
function getCategory(info: DisplayInformations): string | null {
  const line = info.code?.trim();
  if (line) return line;
  const mode = info.physical_mode;
  return (mode && PHYSICAL_MODE_LABELS[mode]) ?? mode ?? null;
}

interface StopDateTime {
  departure_date_time?: string;
  base_departure_date_time?: string;
  arrival_date_time?: string;
  base_arrival_date_time?: string;
}

interface NavitiaLink {
  type: string;
  id: string;
}

interface Passage {
  display_informations: DisplayInformations;
  stop_date_time: StopDateTime;
  links?: NavitiaLink[];
}

interface DisruptionMessage {
  text: string;
}

interface Disruption {
  id: string;
  severity?: { effect?: string };
  messages?: DisruptionMessage[];
}

interface SncfBoardResponse {
  departures?: Passage[];
  arrivals?: Passage[];
  disruptions?: Disruption[];
}

interface NaiveParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Navitia returns local (Europe/Paris) wall-clock times with no timezone marker,
// formatted as "YYYYMMDDTHHMMSS". We parse the components and compare them in a
// shared "naive UTC" space so deltas and the now-window are timezone-correct.
function parseNavitiaDateTime(value: string): NaiveParts {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(4, 6)),
    day: Number(value.slice(6, 8)),
    hour: Number(value.slice(9, 11)),
    minute: Number(value.slice(11, 13)),
    second: Number(value.slice(13, 15)),
  };
}

function naiveMs(parts: NaiveParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function parisNaiveParts(date: Date): NaiveParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function toNavitiaString(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

// Display the station-local time directly from the Navitia string (already Paris-local).
function formatLocalTime(value: string | undefined): string {
  if (!value || value.length < 13) return "--:--";
  return `${value.slice(9, 11)}:${value.slice(11, 13)}`;
}

function calculateDelay(scheduled?: string, realtime?: string): number | null {
  if (!scheduled || !realtime) return null;
  const diff = Math.round(
    (naiveMs(parseNavitiaDateTime(realtime)) - naiveMs(parseNavitiaDateTime(scheduled))) / 60000,
  );
  return diff > 0 ? diff : null;
}

function getStatus(
  realtime: string | undefined,
  nowMs: number,
  arrivals: boolean,
): Train["status"] {
  if (!realtime) return null;
  const actualMs = naiveMs(parseNavitiaDateTime(realtime));
  if (actualMs >= nowMs - RECENT_WINDOW_MS && actualMs <= nowMs + RECENT_WINDOW_MS) {
    return arrivals ? "incoming" : "departing";
  }
  return null;
}

// Navitia formats directions as "Name (City)" — drop the trailing parenthetical.
function cleanPlace(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeFranceTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.SNCF_API_KEY;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new ScraperError("SNCF API key is not configured.", 500);
  }

  const arrivals = type === "arrivals";
  const nowMs = naiveMs(parisNaiveParts(new Date()));
  const fromDatetime = toNavitiaString(nowMs - RECENT_WINDOW_MS);
  const url = buildSncfUrl(stationId, arrivals, fromDatetime);

  const { response, fetchMs } = await fetchWithTimeout(url, "French", {
    headers: {
      // Navitia uses HTTP Basic auth with the API key as the username (empty password).
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    },
  });

  const data: SncfBoardResponse = await response.json();
  const passages = ((arrivals ? data.arrivals : data.departures) ?? []).filter(
    (p) => !NON_RAIL_MODES.has(p.display_informations.physical_mode ?? ""),
  );

  const disruptionsById = new Map<string, Disruption>(
    (data.disruptions ?? []).map((d) => [d.id, d]),
  );

  const trains: Train[] = passages.map((passage) => {
    const info = passage.display_informations;
    const category = getCategory(info);
    // headsign is the passenger-facing mission code (RER/Transilien) or train
    // number; for TER it duplicates the line code, so fall back to the real
    // train number there.
    const headsign = info.headsign ?? "";
    const trainNumber =
      !headsign || headsign === category ? (info.trip_short_name ?? headsign) : headsign;
    const scheduled = arrivals
      ? passage.stop_date_time.base_arrival_date_time
      : passage.stop_date_time.base_departure_date_time;
    const realtime = arrivals
      ? passage.stop_date_time.arrival_date_time
      : passage.stop_date_time.departure_date_time;

    const linked = (passage.links ?? [])
      .filter((link) => link.type === "disruption")
      .map((link) => disruptionsById.get(link.id))
      .filter((d): d is Disruption => Boolean(d));

    const cancelled = linked.some((d) => d.severity?.effect === "NO_SERVICE");
    const messages = linked
      .flatMap((d) => d.messages ?? [])
      .map((m) => stripHtml(m.text))
      .filter(Boolean);

    const train: Train = {
      brand: info.network ?? info.commercial_mode ?? "SNCF",
      category,
      trainNumber,
      scheduledTime: formatLocalTime(scheduled),
      delay: cancelled ? null : calculateDelay(scheduled, realtime),
      platform: null,
      status: cancelled ? "cancelled" : getStatus(realtime, nowMs, arrivals),
      info: messages.length > 0 ? messages.join("; ") : null,
    };

    if (arrivals) {
      // Navitia exposes the vehicle's terminus as `direction`; true origin would
      // require a per-trip lookup, so we surface the line direction here.
      train.origin = cleanPlace(info.direction);
    } else {
      train.destination = cleanPlace(info.direction);
    }

    return train;
  });

  return { trains, info: null, timing: { fetchMs } };
}
