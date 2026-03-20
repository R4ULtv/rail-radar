import type { Train } from "@repo/data";

import { ScraperError, type ScrapeResult } from "./index";
import { fetchWithTimeout } from "./fetch";
import ukStationCodes from "./uk-codes.json";

const LDBWS_BASE_URL =
  "https://api1.raildata.org.uk/1010-live-arrival-and-departure-boards-arr-and-dep1_1/LDBWS/api/20220120";
// Request more since the combined endpoint splits between arrivals and departures
const TRAIN_LIMIT = 30;

// Static numeric suffix → CRS code mapping
const stationCodes = ukStationCodes as Record<string, string>;

// --- LDBWS API response types ---

interface ServiceLocation {
  locationName: string;
  crs: string;
  via?: string;
  futureChangeTo?: string;
  assocIsCancelled?: boolean;
}

interface NRCCMessage {
  Value: string;
}

interface ServiceItemWithCallingPoints {
  origin?: ServiceLocation[];
  destination?: ServiceLocation[];
  currentOrigins?: ServiceLocation[];
  currentDestinations?: ServiceLocation[];
  rsid?: string;
  sta?: string;
  eta?: string;
  std?: string;
  etd?: string;
  platform?: string;
  operator?: string;
  operatorCode?: string;
  isCancelled?: boolean;
  serviceType?: "train" | "bus" | "ferry";
  cancelReason?: string;
  delayReason?: string;
  serviceID?: string;
}

interface StationBoardWithDetails {
  trainServices?: ServiceItemWithCallingPoints[];
  busServices?: ServiceItemWithCallingPoints[];
  ferryServices?: ServiceItemWithCallingPoints[];
  generatedAt?: string;
  locationName?: string;
  crs?: string;
  nrccMessages?: NRCCMessage[];
  platformAvailable?: boolean;
  areServicesAvailable?: boolean;
}

// --- Helpers ---

function getCRS(stationId: string): string {
  const paddedCode = stationId.replace(/^[A-Z]+/, "");
  const crs = stationCodes[paddedCode];
  if (!crs) throw new ScraperError("Unknown UK station.", 404);
  return crs;
}

function buildUrl(crs: string): string {
  return `${LDBWS_BASE_URL}/GetArrivalDepartureBoard/${crs}?numRows=${TRAIN_LIMIT}`;
}

/** Parse an HH:mm string into total minutes since midnight */
function parseHHmm(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
}

/**
 * Calculate delay in minutes from scheduled and estimated HH:mm strings.
 * Handles midnight crossover (e.g., scheduled 23:55, estimated 00:05 = 10 min delay).
 */
function calculateDelay(
  scheduled: string | undefined,
  estimated: string | undefined,
): number | null {
  if (!scheduled || !estimated) return null;
  // estimated can be "On time", "Cancelled", "Delayed", or an HH:mm string
  const estMinutes = parseHHmm(estimated);
  const schMinutes = parseHHmm(scheduled);
  if (estMinutes === null || schMinutes === null) return null;

  let diff = estMinutes - schMinutes;
  // Handle midnight crossover
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  return diff > 0 ? diff : null;
}

function getStatus(
  service: ServiceItemWithCallingPoints,
  type: "arrivals" | "departures",
): Train["status"] {
  if (service.isCancelled) return "cancelled";

  const et = type === "arrivals" ? service.eta : service.etd;
  if (et === "Cancelled") return "cancelled";

  // Check if train is near current time
  const scheduled = type === "arrivals" ? service.sta : service.std;
  if (!scheduled) return null;

  const schMinutes = parseHHmm(scheduled);
  if (schMinutes === null) return null;

  // Get current UK time in minutes
  const now = new Date();
  const ukTime = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  const nowMinutes = parseHHmm(ukTime);
  if (nowMinutes === null) return null;

  let diff = (et && parseHHmm(et) !== null ? parseHHmm(et)! : schMinutes) - nowMinutes;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  if (Math.abs(diff) <= 5) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function getBrand(operatorCode?: string): string {
  return operatorCode?.toUpperCase() ?? "UK";
}

function getCategory(operatorCode?: string): string | null {
  switch (operatorCode) {
    case "VT": // Avanti West Coast
    case "GR": // LNER
    case "XC": // CrossCountry
    case "HT": // Hull Trains
    case "GC": // Grand Central
    case "LD": // Lumo
      return "IC";
    case "CS": // Caledonian Sleeper
      return "SLP";
    case "CH": // Chiltern Railways
    case "HX": // Heathrow Express
    case "GX": // Gatwick Express
    case "ES": // Eurostar
    case "TP": // TransPennine Express
      return "EXP";
    case "XR": // Elizabeth line
    case "IL": // Island Line
      return "EL";
    case "AW": // Transport for Wales
    case "NT": // Northern
    case "EM": // East Midlands Railway
    case "LM": // West Midlands Trains
    case "SR": // ScotRail
    case "GW": // Great Western Railway
    case "SW": // South Western Railway
      return "RE";
    case "SE": // Southeastern
    case "SN": // Southern
    case "TL": // Thameslink
    case "GN": // Great Northern
    case "CC": // c2c
    case "LE": // Greater Anglia
    case "LO": // London Overground
    case "ME": // Merseyrail
      return "S";
    default:
      return null;
  }
}

/** Extract train number from rsid or fall back to serviceID */
function getTrainNumber(service: ServiceItemWithCallingPoints): string {
  if (service.rsid) {
    const match = service.rsid.match(/\d+$/);
    if (match) return match[0];
    return service.rsid;
  }
  // serviceID format: "1320275EUSTON__" — extract leading digits
  if (service.serviceID) {
    const match = service.serviceID.match(/^\d+/);
    if (match) return match[0];
  }
  return "";
}

/** Get destination/origin display name, preferring currentDestinations/currentOrigins */
function getDestination(service: ServiceItemWithCallingPoints): string {
  const locations = service.currentDestinations ?? service.destination;
  if (!locations || locations.length === 0) return "";
  return locations.map((l) => l.locationName).join(" & ");
}

function getOrigin(service: ServiceItemWithCallingPoints): string {
  const locations = service.currentOrigins ?? service.origin;
  if (!locations || locations.length === 0) return "";
  return locations.map((l) => l.locationName).join(" & ");
}

/** Build info string from cancel/delay reasons */
function getInfo(service: ServiceItemWithCallingPoints): string | null {
  const parts: string[] = [];
  if (service.cancelReason) parts.push(service.cancelReason);
  if (service.delayReason) parts.push(service.delayReason);
  return parts.length > 0 ? parts.join(". ") : null;
}

/** Strip HTML tags from NRCC messages */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function mapService(service: ServiceItemWithCallingPoints, type: "arrivals" | "departures"): Train {
  const scheduled = type === "arrivals" ? service.sta : service.std;
  const estimated = type === "arrivals" ? service.eta : service.etd;

  const train: Train = {
    brand: getBrand(service.operatorCode),
    category: getCategory(service.operatorCode),
    trainNumber: getTrainNumber(service),
    scheduledTime: scheduled ?? "--:--",
    delay: calculateDelay(scheduled, estimated),
    platform: service.platform ?? null,
    status: getStatus(service, type),
    info: getInfo(service),
  };

  if (type === "departures") {
    train.destination = getDestination(service);
  } else {
    train.origin = getOrigin(service);
  }

  return train;
}

// --- Main scraper ---

export async function scrapeUKTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const apiKey = env?.LDBWS_API_KEY;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new ScraperError("LDBWS API key is not configured.", 500);
  }

  const crs = getCRS(stationId);
  const url = buildUrl(crs);

  const { response, fetchMs } = await fetchWithTimeout(url, "UK", {
    headers: { "x-apikey": apiKey },
  });

  const data: StationBoardWithDetails = await response.json();

  // Only map trainServices (skip bus/ferry), filter by type
  const services = (data.trainServices ?? []).filter((s) =>
    type === "arrivals" ? s.sta !== undefined : s.std !== undefined,
  );

  const trains: Train[] = services.map((service) => mapService(service, type));

  // NRCC messages as station-level info
  const nrccMessages = data.nrccMessages?.map((m) => stripHtml(m.Value)).filter(Boolean);
  const info = nrccMessages && nrccMessages.length > 0 ? nrccMessages.join(" | ") : null;

  return { trains, info, timing: { fetchMs } };
}
