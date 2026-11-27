import type { Train } from "@repo/data";

import frStationCodes from "./codes/fr-codes.json";
import { STATUS_WINDOW_MS, ScraperError, type ScrapeResult, statusFromWindow } from "./core";
import { fetchJsonWithTimeout } from "./fetch";

const SNCF_BASE_URL = "https://api.navitia.io/v1/coverage/sncf";
const PARIS_TZ = "Europe/Paris";
const RECENT_WINDOW_MS = STATUS_WINDOW_MS;
const TRAIN_LIMIT = 24;

// Navitia merges SNCF and Île-de-France Mobilités stop places under either namespace.
const stopAreas: Readonly<Record<string, string>> = frStationCodes;

function buildSncfUrl(
  stationId: string,
  type: "arrivals" | "departures",
  fromDatetime: string,
): string {
  const stopArea = stopAreas[stationId];
  if (!stopArea) throw new ScraperError("SNCF has no board for this station.", 404);

  const params = new URLSearchParams({
    data_freshness: "realtime",
    count: String(TRAIN_LIMIT),
    disable_geojson: "true",
    from_datetime: fromDatetime,
  });
  // Combined stop areas include Métro and bus platforms. Filter before Navitia limits the board.
  for (const mode of ["Metro", "Bus", "Coach", "Car", "Bike", "BikeSharingService"]) {
    params.append("forbidden_uris[]", `physical_mode:${mode}`);
  }
  return `${SNCF_BASE_URL}/stop_areas/${encodeURIComponent(stopArea)}/${type}?${params.toString()}`;
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
  links?: NavitiaLink[];
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
const NON_RAIL_MODES = new Set(["Métro", "Bus", "Autocar", "Car", "Bike", "BikeSharingService"]);

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
  rel?: string;
  type: string;
  id: string;
}

interface StopPoint {
  // Available when the source models individual platforms.
  platform_code?: string | null;
}

interface Passage {
  display_informations: DisplayInformations;
  stop_date_time: StopDateTime;
  stop_point?: StopPoint;
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
  origins?: { id: string; name: string }[];
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
  return statusFromWindow(actualMs, nowMs, RECENT_WINDOW_MS, arrivals ? "arrivals" : "departures");
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
  const url = buildSncfUrl(stationId, type, fromDatetime);

  const { data, fetchMs } = await fetchJsonWithTimeout<SncfBoardResponse>(url, "French", {
    headers: {
      // Navitia uses HTTP Basic auth with the API key as the username (empty password).
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    },
  });
  const passages = ((arrivals ? data.arrivals : data.departures) ?? []).filter(
    (p) => !NON_RAIL_MODES.has(p.display_informations.physical_mode ?? ""),
  );

  const disruptionsById = new Map<string, Disruption>(
    (data.disruptions ?? []).map((d) => [d.id, d]),
  );

  const originsById = new Map(arrivals ? data.origins?.map(({ id, name }) => [id, name]) : []);

  const trains: Train[] = passages.map((passage) => {
    const info = passage.display_informations;
    const category = getCategory(info);
    const destination = cleanPlace(info.direction ?? "");
    // NeTEx often uses the destination as the headsign. IDFM also publishes mission codes here.
    const headsign = info.headsign === destination ? "" : (info.headsign ?? "");
    const trainNumber =
      !headsign || headsign === category ? (info.trip_short_name ?? headsign) : headsign;
    const scheduled = arrivals
      ? passage.stop_date_time.base_arrival_date_time
      : passage.stop_date_time.base_departure_date_time;
    const realtime = arrivals
      ? passage.stop_date_time.arrival_date_time
      : passage.stop_date_time.departure_date_time;

    // The passage and its display informations often link the same disruption.
    const linkedIds = new Set(
      [...(passage.links ?? []), ...(info.links ?? [])]
        .filter((link) => link.type === "disruption")
        .map((link) => link.id),
    );
    const linked = [...linkedIds]
      .map((id) => disruptionsById.get(id))
      .filter((d): d is Disruption => Boolean(d));

    const cancelled = linked.some((d) => d.severity?.effect === "NO_SERVICE");
    // Separate disruptions can also carry the same text.
    const messages = [
      ...new Set(
        linked
          .flatMap((d) => d.messages ?? [])
          .map((m) => stripHtml(m.text))
          .filter(Boolean),
      ),
    ];

    const train: Train = {
      brand: info.network ?? info.commercial_mode ?? "SNCF",
      category,
      trainNumber,
      scheduledTime: formatLocalTime(scheduled),
      delay: cancelled ? null : calculateDelay(scheduled, realtime),
      platform: passage.stop_point?.platform_code?.trim() || null,
      status: cancelled ? "cancelled" : getStatus(realtime, nowMs, arrivals),
      info: messages.length > 0 ? messages.join("; ") : null,
    };

    if (arrivals) {
      const originLink = info.links?.find(
        (link) => link.type === "stop_area" && link.rel === "origins",
      );
      const origin = originLink && originsById.get(originLink.id);
      if (origin) train.origin = origin;
    } else {
      train.destination = destination;
    }

    return train;
  });

  return { trains, info: null, timing: { fetchMs } };
}
