import type { Train } from "@repo/data";

import type { ScrapeResult } from "./core";
import { ScraperError } from "./core";
import { fetchWithTimeout } from "./fetch";
import ieStationCodes from "./codes/ie-codes.json";

const IE_BASE_URL =
  "https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML_WithNumMins";

// Static numeric ID → station code mapping
const stationCodes = ieStationCodes as Record<string, string>;

function buildUrl(stationId: string, numMins = 90): string {
  const numericId = stationId.replace(/^[A-Z]+/, "");
  const code = stationCodes[numericId];
  if (!code) {
    throw new ScraperError(`Unknown Irish station ID: ${stationId}`, 400);
  }
  return `${IE_BASE_URL}?StationCode=${code}&NumMins=${numMins}`;
}

// Extract the text content of a single XML tag within a record block.
// The Irish Rail API returns clean server-generated XML, so a scoped regex
// is both sufficient and far more robust than HTML-mode stream parsing.
function getTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseRecord(block: string, type: "arrivals" | "departures"): Train | null {
  const trainNumber = getTag(block, "Traincode");
  if (!trainNumber) return null;

  const locationtype = getTag(block, "Locationtype");

  // Filter by locationtype: O=origin, D=destination, S=stop (through)
  // Departures: show O (originates here) and S (passes through)
  // Arrivals: show D (terminates here) and S (passes through)
  if (type === "departures" && locationtype === "D") return null;
  if (type === "arrivals" && locationtype === "O") return null;

  const origin = getTag(block, "Origin");
  const destination = getTag(block, "Destination");
  const scharrival = getTag(block, "Scharrival");
  const schdepart = getTag(block, "Schdepart");

  // Determine scheduled time based on arrivals/departures
  // "00:00" means not applicable (origin has no arrival, destination has no departure)
  const scheduledTime =
    type === "arrivals"
      ? scharrival !== "00:00"
        ? scharrival
        : schdepart
      : schdepart !== "00:00"
        ? schdepart
        : scharrival;

  // Parse delay - clamp negative values (early trains) to 0, matching UK scraper behavior
  const lateNum = parseInt(getTag(block, "Late"), 10);
  const delay = isNaN(lateNum) ? null : lateNum > 0 ? lateNum : 0;

  // Map status — only show incoming/departing if train is due within 5 minutes
  let trainStatus: Train["status"] = null;
  const dueinMin = parseInt(getTag(block, "Duein"), 10);
  const statusLower = getTag(block, "Status").toLowerCase();
  if (statusLower === "en route" || statusLower === "arriving") {
    if (!isNaN(dueinMin) && dueinMin <= 5) {
      trainStatus = type === "arrivals" ? "incoming" : "departing";
    }
  }

  // Map train type to category
  const traintype = getTag(block, "Traintype");
  const category = traintype === "Train" ? "Intercity" : traintype;

  return {
    brand: "IR",
    category: category || null,
    trainNumber,
    ...(type === "departures" ? { destination } : { origin }),
    scheduledTime: scheduledTime || "--:--",
    delay,
    platform: null,
    status: trainStatus,
    info: null,
  };
}

export async function scrapeIrelandTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildUrl(stationId);
  const { response, fetchMs } = await fetchWithTimeout(url, "Irish");

  const xml = await response.text();

  if (!xml.includes("ArrayOfObjStationData")) {
    throw new ScraperError("Invalid response from Irish Rail API.", 502);
  }

  const blocks = xml.match(/<objStationData>([\s\S]*?)<\/objStationData>/gi) ?? [];

  const trains: Train[] = [];
  for (const block of blocks) {
    const train = parseRecord(block, type);
    if (train) trains.push(train);
  }

  // Sort by scheduled time, deduplicate by train number, and limit to 16
  trains.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const seen = new Set<string>();
  const filtered = trains
    .filter((t) => {
      if (seen.has(t.trainNumber)) return false;
      seen.add(t.trainNumber);
      return true;
    })
    .slice(0, 16);

  return {
    trains: filtered,
    info: null,
    timing: { fetchMs },
  };
}
