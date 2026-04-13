import type { Train } from "@repo/data";

import { type ScrapeResult, formatTime } from "./index";
import { fetchWithTimeout } from "./fetch";

const DB_BOARD_URL = "https://app.services-bahn.de/mob/bahnhofstafel";
const CONTENT_TYPE = "application/x.db.vendo.mob.bahnhofstafeln.v2+json";
const TRAIN_LIMIT = 24;

// Exclude clearly non-rail modes; keep all DB rail product categories.
const NON_RAIL_PRODUCTS = new Set(["BUS", "SCHIFF", "STR", "UBAHN"]);

function convertGermanStationId(stationId: string): string {
  // Convert DE station ID to HAFAS format (e.g., "DE00261" -> "8000261")
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  return `80${numericPart}`;
}

function formatLid(evaNumber: string): string {
  return `A=1@L=${evaNumber}@`;
}

function getDedupLocation(entry: DbBoardEntry, type: "arrivals" | "departures"): string {
  return type === "departures" ? (entry.richtung ?? "") : (entry.abgangsOrt?.name ?? "");
}

function getBoardTime(entry: DbBoardEntry, type: "arrivals" | "departures"): string {
  return type === "departures" ? (entry.abgangsDatum ?? "") : (entry.ankunftsDatum ?? "");
}

function getPlatform(entry: DbBoardEntry): string {
  return entry.ezGleis ?? entry.gleis ?? entry.plattform ?? "";
}

function getZuglaufField(zuglaufId: string | undefined, field: string): string | null {
  if (!zuglaufId) return null;
  const match = zuglaufId.match(new RegExp(`#${field}#([^#]*)#`));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function getRouteSignature(entry: DbBoardEntry): string | null {
  const parts = [
    getZuglaufField(entry.zuglaufId, "CA"),
    getZuglaufField(entry.zuglaufId, "FR"),
    getZuglaufField(entry.zuglaufId, "FT"),
    getZuglaufField(entry.zuglaufId, "TO"),
    getZuglaufField(entry.zuglaufId, "TT"),
  ];

  return parts.some(Boolean) ? parts.join("|") : null;
}

function getDedupKey(entry: DbBoardEntry, type: "arrivals" | "departures"): string {
  const fallbackSignature = [
    entry.kurztext ?? "",
    entry.zugnummer ?? entry.mitteltext ?? "",
    getDedupLocation(entry, type),
  ].join("|");

  return [getBoardTime(entry, type), getPlatform(entry), getRouteSignature(entry) ?? fallbackSignature].join(
    "|",
  );
}

function getGroupedTrainKey(train: Train): string {
  return [
    train.brand ?? "",
    train.category ?? "",
    train.scheduledTime,
    train.delay ?? "",
    train.platform ?? "",
    train.status ?? "",
    train.info ?? "",
  ].join("::");
}

function getDisplayLabel(entry: DbBoardEntry): string {
  const mediumText = entry.mitteltext?.trim();
  if (mediumText) return mediumText;

  return [entry.kurztext ?? "", entry.zugnummer ?? ""].join(" ").trim();
}

function mergeArrivalBranches(
  trains: Array<{ train: Train; displayLabel: string }>,
): Train[] {
  const grouped = new Map<string, { train: Train; origins: string[] }>();

  for (const { train, displayLabel } of trains) {
    const key = [getGroupedTrainKey(train), displayLabel].join("::");
    const origin = train.origin?.trim();
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        train: { ...train },
        origins: origin ? [origin] : [],
      });
      continue;
    }

    if (origin && !existing.origins.includes(origin)) {
      existing.origins.push(origin);
    }
  }

  return Array.from(grouped.values()).map(({ train, origins }) =>
    origins.length > 0 ? { ...train, origin: origins.join(" / ") } : train,
  );
}

// Raw DB API response types
interface DbBoardEntry {
  abfrageOrt?: { name?: string; evaNr?: string };
  // Departure fields
  abgangsDatum?: string;
  ezAbgangsDatum?: string;
  // Arrival fields
  ankunftsDatum?: string;
  ezAnkunftsDatum?: string;
  // Common fields
  kurztext?: string;
  mitteltext?: string;
  gleis?: string;
  ezGleis?: string;
  plattform?: string;
  produktGattung?: string;
  richtung?: string;
  abgangsOrt?: { name?: string };
  zugnummer?: string;
  zuglaufId?: string;
  echtzeitNotizen?: Array<{ text?: string; prio?: string }>;
  cancelled?: boolean;
}

interface DbBoardResponse {
  bahnhofstafelAbfahrtPositionen?: DbBoardEntry[];
  bahnhofstafelAnkunftPositionen?: DbBoardEntry[];
}

function getBrand(entry: DbBoardEntry): string | null {
  const cat = entry.kurztext?.toUpperCase();
  if (!cat) return null;
  // Local operators
  if (cat === "FLX") return "FlixTrain";
  if (cat === "ARV") return "Arriva";
  if (cat === "BRB") return "Transdev";
  if (cat === "HLB") return "HLB";
  if (cat === "OE") return "ODEG";
  if (cat === "STN") return "STB";
  if (cat === "VIA") return "Vias";
  if (cat === "WB") return "WestfalenBahn";
  if (cat === "VLX") return "Vogtlandbahn";
  // International operators
  if (cat === "TGV") return "SNCF";
  if (cat === "RJX" || cat === "RJ" || cat === "NJ") return "OBB";
  if (cat === "EUR") return "Eurostar";
  if (cat === "THA") return "Thalys";
  return "DB";
}

function getDelay(scheduled: string | undefined, realtime: string | undefined): number | null {
  if (!scheduled || !realtime) return null;
  const diff = new Date(realtime).getTime() - new Date(scheduled).getTime();
  const minutes = Math.round(diff / 60000);
  return minutes || null;
}

function getStatus(
  scheduled: string | undefined,
  realtime: string | undefined,
  cancelled: boolean | undefined,
  type: "arrivals" | "departures",
): "incoming" | "departing" | "cancelled" | null {
  if (cancelled) return "cancelled";

  const timeStr = realtime ?? scheduled;
  if (!timeStr) return null;

  const actualTime = new Date(timeStr).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (actualTime >= now - fiveMinutes && actualTime <= now + fiveMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function getInfo(entry: DbBoardEntry): string | null {
  const notes = entry.echtzeitNotizen;
  if (!notes || notes.length === 0) return null;
  const texts = notes.map((n) => n.text).filter(Boolean);
  return texts.length > 0 ? texts.join("; ") : null;
}

export async function scrapeGermanTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const evaNumber = convertGermanStationId(stationId);
  const now = new Date();
  const path = type === "departures" ? "abfahrt" : "ankunft";
  const url = `${DB_BOARD_URL}/${path}`;

  const body = JSON.stringify({
    anfragezeit: formatTime(now.toISOString(), "Europe/Berlin"),
    datum: now.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }),
    ursprungsBahnhofId: formatLid(evaNumber),
    verkehrsmittel: ["ALL"],
  });

  const { response, fetchMs } = await fetchWithTimeout(url, "German", {
    method: "POST",
    headers: {
      "Content-Type": CONTENT_TYPE,
      Accept: CONTENT_TYPE,
      "X-Correlation-ID": `${crypto.randomUUID()}_${crypto.randomUUID()}`,
    },
    body,
  });

  const data: DbBoardResponse = await response.json();

  const entries =
    (type === "departures"
      ? data.bahnhofstafelAbfahrtPositionen
      : data.bahnhofstafelAnkunftPositionen) ?? [];

  // Exclude non-rail products, collapse DB alias rows, then merge same-service arrival branches.
  const seen = new Set<string>();
  const trainEntries = entries
    .filter((entry) => {
      const product = entry.produktGattung?.toUpperCase();
      if (product && NON_RAIL_PRODUCTS.has(product)) return false;
      // Skip non-revenue services (Sonderfahrt etc.) that lack destination/origin
      if (type === "departures" && !entry.richtung) return false;
      if (type === "arrivals" && !entry.abgangsOrt?.name) return false;
      const dedupKey = getDedupKey(entry, type);
      if (seen.has(dedupKey)) return false;
      seen.add(dedupKey);
      return true;
    });

  const mappedEntries = trainEntries.map((entry) => {
    const scheduledDep = entry.abgangsDatum;
    const realtimeDep = entry.ezAbgangsDatum;
    const scheduledArr = entry.ankunftsDatum;
    const realtimeArr = entry.ezAnkunftsDatum;

    const scheduled = type === "departures" ? scheduledDep : scheduledArr;
    const realtime = type === "departures" ? realtimeDep : realtimeArr;

    const train: Train = {
      brand: getBrand(entry),
      category: entry.kurztext || null,
      trainNumber: entry.zugnummer || entry.mitteltext?.replace(/^\S+\s+/, "") || "",
      scheduledTime: formatTime(scheduled ?? null, "Europe/Berlin"),
      delay: getDelay(scheduled, realtime),
      platform: getPlatform(entry) || null,
      status: getStatus(scheduled, realtime, entry.cancelled, type),
      info: getInfo(entry),
    };

    if (type === "departures") {
      train.destination = entry.richtung ?? undefined;
    } else {
      train.origin = entry.abgangsOrt?.name ?? undefined;
    }

    return {
      train,
      displayLabel: getDisplayLabel(entry),
    };
  });

  const trains = (
    type === "arrivals" ? mergeArrivalBranches(mappedEntries) : mappedEntries.map(({ train }) => train)
  ).slice(0, TRAIN_LIMIT);

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
