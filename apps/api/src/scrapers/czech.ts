import type { Train } from "@repo/data";

import { ScraperError, type ScrapeResult } from "./core";
import { fetchTextWithTimeout } from "./fetch";

// Správa železnic's public station boards (Infotabule), keyed by the seven-digit CIS code.
const BOARD_URL = "https://www.spravazeleznic.cz/cestujici/infotabule";
// The page renders without its board when the request carries no User-Agent.
const HEADERS = { "User-Agent": "RailRadar/1.0 (+https://railradar24.com)" };
/** Shown by Infotabule for a known station that has no electronic passenger information. */
const NO_BOARD = "nejsou v této stanici k dispozici";
const NO_BOARD_NOTE = "Správa železnic has no live board for this station right now.";

type BoardType = "arrivals" | "departures";

function cleanText(value: string): string {
  return value
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) =>
      String.fromCodePoint(
        code[0]?.toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code),
      ),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Infotabule marks an empty cell with a dash. */
function optional(value: string | undefined): string | null {
  return value && !/^[-–—]$/.test(value) ? value : null;
}

function minutes(value: string): number | null {
  const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Signed distance on a clock, including boards that cross midnight. */
function minuteDifference(later: number, earlier: number): number {
  return ((later - earlier + 2160) % 1440) - 720;
}

/** Returns null when the page carries no board for the requested type. */
async function parseBoard(html: string, type: BoardType): Promise<Train[] | null> {
  const arrival = type === "arrivals";
  // PrimeFaces prefixes generated IDs, so match the stable suffix.
  const table = `tbody[id$="${arrival ? "listArrivals" : "listDepartures"}_data"]`;
  let foundTable = false;
  let cells: string[] | undefined;
  let note = false;
  const trains: Train[] = [];
  const now = minutes(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Prague" }))!;

  function finishRow() {
    if (!cells) return;
    const values = cells.map(cleanText);
    cells = undefined;
    // Service notices are separate full-width rows immediately after their train.
    if (note) {
      const train = trains[trains.length - 1];
      if (train && values[0]) train.info = [train.info, values[0]].filter(Boolean).join(" · ");
      return;
    }
    // Arrivals: origin, line, scheduled, actual, train, platform.
    // Departures: scheduled, actual, train, line, destination, intermediate stops, platform.
    const scheduled = minutes(values[arrival ? 2 : 0] ?? "");
    const service = values[arrival ? 4 : 2]?.match(/^(?:(\S+)\s+)?(\d+\S*)(?:\s+(.+))?$/);
    const direction = values[arrival ? 0 : 4];
    if (values.length !== (arrival ? 6 : 7) || scheduled === null || !service || !direction) {
      throw new ScraperError(
        "The Czech train data source returned an unrecognized board row.",
        502,
      );
    }
    const actualText = values[arrival ? 3 : 1]!;
    const actual = minutes(actualText);
    // A cancelled train reads "NEJEDE" in place of its intermediate stops.
    const stops = arrival ? null : optional(values[5]);
    const cancelled = /odřek|zrušen|nejede|cancel/i.test(`${actualText} ${stops ?? ""}`);
    const delay = cancelled
      ? null
      : actual === null
        ? 0
        : Math.max(0, minuteDifference(actual, scheduled));
    const nearNow = Math.abs(minuteDifference(actual ?? scheduled, now)) <= 5;
    const line = optional(values[arrival ? 1 : 3]);
    const via = cancelled ? null : stops;
    // "1 / 3" is platform and track; a missing track is a dash.
    const platform = optional(values[arrival ? 5 : 6]?.replace(/\s*\/\s*[-–—]$/, ""));
    trains.push({
      brand: service[3] ?? null,
      category: service[1] ?? null,
      trainNumber: service[2]!,
      ...(arrival ? { origin: direction } : { destination: direction }),
      scheduledTime: `${String(Math.floor(scheduled / 60)).padStart(2, "0")}:${String(scheduled % 60).padStart(2, "0")}`,
      delay,
      platform,
      status: cancelled ? "cancelled" : nearNow ? (arrival ? "incoming" : "departing") : null,
      info:
        [line ? `Line ${line}` : "", via ? `Via ${via}` : ""].filter(Boolean).join(" · ") || null,
    });
  }

  await new HTMLRewriter()
    .on(table, {
      element() {
        foundTable = true;
      },
    })
    .on(`${table} > tr`, {
      element(element) {
        finishRow();
        // PrimeFaces renders an empty table as a single placeholder row.
        const empty = element.getAttribute("class")?.includes("ui-datatable-empty-message");
        cells = empty ? undefined : [];
        note = false;
      },
    })
    .on(`${table} > tr > td`, {
      element(element) {
        cells?.push("");
        if (element.hasAttribute("colspan")) note = true;
      },
      text(chunk) {
        if (cells?.length) cells[cells.length - 1] += chunk.text;
      },
    })
    .transform(new Response(html))
    .text();
  finishRow();
  if (!foundTable) return null;
  // Infotabule already orders each board chronologically, including across midnight.
  const seen = new Set<string>();
  return trains.filter((train) => {
    const key = `${train.trainNumber}|${train.scheduledTime}|${train.origin ?? train.destination}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function scrapeCzechTrains(
  stationId: string,
  type: BoardType = "departures",
): Promise<ScrapeResult> {
  const code = stationId.match(/^CZ(54\d{5})$/)?.[1];
  if (!code) throw new ScraperError("Unknown Czech station ID.", 404);

  const { text, fetchMs } = await fetchTextWithTimeout(`${BOARD_URL}?station=${code}`, "Czech", {
    headers: HEADERS,
  });
  const timing = { fetchMs };
  try {
    const trains = await parseBoard(text, type);
    if (trains) return { trains, info: null, timing };
    // Small stops without electronic information still render the page, just without a board.
    if (text.includes(NO_BOARD)) return { trains: [], info: NO_BOARD_NOTE, timing };
    throw new ScraperError("The Czech train data source returned an invalid station board.", 502);
  } catch (error) {
    if (error instanceof ScraperError) {
      throw new ScraperError(error.message, error.statusCode, timing, { cause: error });
    }
    throw error;
  }
}
