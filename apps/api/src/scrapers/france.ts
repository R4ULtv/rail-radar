import type { Train } from "@repo/data";

import frStationCodes from "./codes/fr-codes.json";
import { STATUS_WINDOW_MS, ScraperError, type ScrapeResult, statusFromWindow } from "./core";
import { fetchJsonWithTimeout } from "./fetch";
import { getSiriStopCalls, type SiriStopCall } from "./france-siri";

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

const SNCF_NETWORK_BRANDS = new Map([
  ["atlantique", "TGV INOUI"],
  ["est", "TGV INOUI"],
  ["nord", "TGV INOUI"],
  ["sud est", "TGV INOUI"],
  ["france espagne", "TGV INOUI"],
  ["tgv italie", "TGV INOUI"],
  ["alleo", "DB SNCF"],
  ["lyria", "TGV Lyria"],
  ["thalys", "Eurostar"],
  ["intercites nantes", "Intercités"],
  ["lignes d'amenagement du territoire", "Intercités"],
  ["lignes de nuit", "Intercités"],
  ["palito", "Intercités"],
  ["paris clermont", "Intercités"],
  ["transversale sud", "Intercités"],
  ["ter auvergne rhone alpes", "TER Auvergne-Rhône-Alpes"],
  ["ter grand est", "Fluo Grand Est"],
  ["ter nouvelle aquitaine", "TER Nouvelle-Aquitaine"],
  ["ter provence alpes cote d'azur", "ZOU !"],
  ["ratp cap arc sud et ouest", "RATP"],
]);

const SNCF_COMMERCIAL_BRANDS = new Map([
  ["intercites", "Intercités"],
  ["tgv inoui", "TGV INOUI"],
  ["tgv lyria", "TGV Lyria"],
  ["lyria", "TGV Lyria"],
  ["ouigo", "OUIGO"],
  ["ouigo train classique", "OUIGO"],
  ["ter", "TER"],
  ["rer", "RER"],
  ["transilien", "Transilien"],
  ["train transilien", "Transilien"],
  ["eurostar", "Eurostar"],
  ["thalys", "Eurostar"],
]);

function brandKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/’/g, "'")
    .replace(/[\s-]+/g, " ");
}

function getBrand(info: DisplayInformations): string {
  const network = info.network?.trim() || "";
  const key = brandKey(network);
  const commercialMode = info.commercial_mode?.trim() || "";

  // The NeTEx catalogue files the Léman Express lines under TER Auvergne-Rhône-Alpes.
  if (key === "ter auvergne rhone alpes" && /^L[1-7]$/.test(info.code?.trim() ?? "")) {
    return "Léman Express";
  }

  const brand = SNCF_NETWORK_BRANDS.get(key);
  if (brand) return brand;
  if (key.startsWith("ter ")) return "TER";
  if (network && key !== "sncf") return network;

  return (
    SNCF_COMMERCIAL_BRANDS.get(brandKey(commercialMode)) ?? (network || commercialMode || "SNCF")
  );
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

// NeTEx gives long-distance lines internal codes such as "001B" that passengers never see.
const INTERNAL_LINE_CODE = /^\d{3}[A-Z]$/;

const BRAND_CATEGORIES = new Map([
  ["TGV INOUI", "TGV"],
  ["TGV Lyria", "TGV"],
  ["Intercités", "IC"],
]);

function getBrandCategory(info: DisplayInformations, brand: string): string | null {
  if (brand !== "OUIGO") return BRAND_CATEGORIES.get(brand) ?? null;
  // OUIGO Train Classique runs on the classic network. SNCF files it as Intercités or local rail.
  const classic =
    info.commercial_mode === "Intercités" || info.physical_mode === "Train Transilien";
  return classic ? null : "TGV";
}

// Use the passenger-facing line code when present and fall back to the brand or physical mode.
function getCategory(info: DisplayInformations, brand: string): string | null {
  const line = info.code?.trim();
  if (line && !INTERNAL_LINE_CODE.test(line)) return line;
  if (line) return getBrandCategory(info, brand);
  const mode = info.physical_mode;
  return (mode && PHYSICAL_MODE_LABELS[mode]) ?? mode ?? null;
}

interface StopDateTime {
  departure_date_time?: string;
  base_departure_date_time?: string;
  arrival_date_time?: string;
  base_arrival_date_time?: string;
  // "realtime" only when Navitia applied a live update to this trip.
  data_freshness?: string;
  links?: NavitiaLink[];
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

const PARIS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: PARIS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function parisNaiveParts(date: Date): NaiveParts {
  const parts = PARIS_FORMAT.formatToParts(date);
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

function calculateDelay(scheduledMs: number | null, actualMs: number | null): number | null {
  if (scheduledMs === null || actualMs === null) return null;
  const diff = Math.round((actualMs - scheduledMs) / 60000);
  return diff > 0 ? diff : null;
}

interface SiriUpdate {
  // Paris wall-clock "naive" ms, or null when SNCF has no reliable prediction.
  expectedMs: number | null;
  platform: string | null;
  cancelled: boolean;
}

// SIRI uses absolute times. Key each call by train number and aimed Paris wall-clock time,
// which identifies the trip on this board.
function indexSiriCalls(calls: SiriStopCall[], arrivals: boolean): Map<string, SiriUpdate> {
  const index = new Map<string, SiriUpdate>();
  for (const call of calls) {
    const time = arrivals ? call.arrival : call.departure;
    if (!time) continue;
    const aimedMs = naiveMs(parisNaiveParts(new Date(time.aimedAt)));
    const update: SiriUpdate = {
      expectedMs:
        time.expectedAt === null ? null : naiveMs(parisNaiveParts(new Date(time.expectedAt))),
      platform: time.platform,
      cancelled: call.cancelled,
    };
    for (const trainNumber of call.trainNumbers) index.set(`${trainNumber}@${aimedMs}`, update);
  }
  return index;
}

// Navitia formats directions as "Name (City)" — drop the trailing parenthetical.
function cleanPlace(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function getTrainNumber(info: DisplayInformations, destination: string, category: string | null) {
  // IDFM publishes mission codes in the headsign. NeTEx can repeat the destination there.
  const rawHeadsign = info.headsign?.trim() ?? "";
  const headsign = cleanPlace(rawHeadsign) === destination ? "" : rawHeadsign;
  if (headsign && headsign !== category) return headsign;

  const tripNumber = info.trip_short_name?.trim() ?? "";
  return tripNumber && cleanPlace(tripNumber) !== destination ? tripNumber : headsign;
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

  // Navitia applies SNCF's live feed to only some trips. SNCF's own SIRI feed fills the gaps.
  const [{ data, fetchMs }, siriCalls] = await Promise.all([
    fetchJsonWithTimeout<SncfBoardResponse>(url, "French", {
      headers: {
        // Navitia uses HTTP Basic auth with the API key as the username (empty password).
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      },
    }),
    getSiriStopCalls(stationId),
  ]);
  const siriUpdates = indexSiriCalls(siriCalls, arrivals);
  const passages = ((arrivals ? data.arrivals : data.departures) ?? []).filter(
    (p) => !NON_RAIL_MODES.has(p.display_informations.physical_mode ?? ""),
  );

  const disruptionsById = new Map<string, Disruption>(
    (data.disruptions ?? []).map((d) => [d.id, d]),
  );

  const originsById = new Map(arrivals ? data.origins?.map(({ id, name }) => [id, name]) : []);

  const trains: Train[] = passages.map((passage) => {
    const info = passage.display_informations;
    const times = passage.stop_date_time;
    const brand = getBrand(info);
    const category = getCategory(info, brand);
    const destination = cleanPlace(info.direction ?? "");
    const scheduled = arrivals ? times.base_arrival_date_time : times.base_departure_date_time;
    const realtime = arrivals ? times.arrival_date_time : times.departure_date_time;
    const scheduledMs = scheduled ? naiveMs(parseNavitiaDateTime(scheduled)) : null;
    // Transilien trips can carry a paired number such as "129602-129603".
    const tripNumbers = info.trip_short_name?.split("-").map((n) => n.trim()) ?? [];
    const siri =
      scheduledMs === null
        ? undefined
        : tripNumbers
            .map((n) => siriUpdates.get(`${n}@${scheduledMs}`))
            .find((update) => update !== undefined);
    // Base-schedule times are only the timetable. Show no delay or live status for them.
    const navitiaLiveMs =
      times.data_freshness === "realtime" && realtime
        ? naiveMs(parseNavitiaDateTime(realtime))
        : null;
    const actualMs = siri?.expectedMs ?? navitiaLiveMs;

    const stopLinks = [...(info.links ?? []), ...(times.links ?? [])];
    // Navitia can link the same disruption in several places.
    const linkedIds = new Set(
      [...(passage.links ?? []), ...stopLinks]
        .filter((link) => link.type === "disruption")
        .map((link) => link.id),
    );
    const linked = [...linkedIds]
      .map((id) => disruptionsById.get(id))
      .filter((d): d is Disruption => Boolean(d));

    const cancelled =
      siri?.cancelled === true || linked.some((d) => d.severity?.effect === "NO_SERVICE");
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
      brand,
      category,
      trainNumber: getTrainNumber(info, destination, category),
      scheduledTime: formatLocalTime(scheduled ?? realtime),
      delay: cancelled ? null : calculateDelay(scheduledMs, actualMs),
      platform: siri?.platform || passage.stop_point?.platform_code?.trim() || null,
      status: cancelled
        ? "cancelled"
        : actualMs === null
          ? null
          : statusFromWindow(actualMs, nowMs, RECENT_WINDOW_MS, type),
      info: messages.length > 0 ? messages.join("; ") : null,
    };

    if (arrivals) {
      const originLink = stopLinks.find(
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
