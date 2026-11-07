import type { Train } from "@repo/data";

import stationCodes from "./codes/cz-codes.json";
import { ScraperError, type ScrapeResult } from "./core";
import { fetchTextWithTimeout } from "./fetch";

const BASE_URL = "https://grapp.spravazeleznic.cz";
const SOURCE_NOTE = "GRAPP / Správa železnic: live boards cover roughly the next hour.";
const CODES: Record<string, number> = stationCodes;

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

function minutes(value: string): number | null {
  const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Signed distance on a clock, including boards that cross midnight. */
function minuteDifference(later: number, earlier: number): number {
  return ((later - earlier + 2160) % 1440) - 720;
}

async function parseBoard(html: string, type: BoardType): Promise<Train[]> {
  const section = type === "arrivals" ? "stationArrival" : "stationDeparture";
  let foundSection = false;
  let cells: string[] | undefined;
  let fullWidthNote = false;
  const trains: Train[] = [];
  const now = minutes(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Prague" }))!;

  function finishRow() {
    if (!cells) return;
    const values = cells.map(cleanText);
    // Service notices are separate full-width rows immediately after their train.
    if (values.length === 1 && fullWidthNote && trains.length > 0) {
      const train = trains[trains.length - 1]!;
      train.info = [train.info, values[0]].filter(Boolean).join(" · ") || null;
      return;
    }
    const arrival = type === "arrivals";
    const scheduled = minutes(values[arrival ? 4 : 3] ?? "");
    // Desktop and mobile columns are duplicated in GRAPP; use the desktop fields only.
    // Departures also have a separate destination and intermediate-stops column.
    const service = values[arrival ? 6 : 5]?.match(/^(?:(\S+)\s+)?(\d+\S*)(?:\s+(.+))?$/);
    const direction = values[arrival ? 0 : 7];
    if (values.length !== (arrival ? 8 : 10) || scheduled === null || !service || !direction) {
      throw new ScraperError(
        "The Czech train data source returned an unrecognized board row.",
        502,
      );
    }
    const actualText = values[arrival ? 5 : 4]!;
    const actual = minutes(actualText);
    const cancelled = /odřek|zrušen|nejede|cancel/i.test(actualText);
    const delay = cancelled
      ? null
      : actual === null
        ? 0
        : Math.max(0, minuteDifference(actual, scheduled));
    const nearNow = Math.abs(minuteDifference(actual ?? scheduled, now)) <= 5;
    const platform = values[arrival ? 7 : 9];
    const line = values[arrival ? 3 : 6];
    const via = arrival ? "" : values[8];
    trains.push({
      brand: service[3] ?? null,
      category: service[1] ?? null,
      trainNumber: service[2]!,
      ...(arrival ? { origin: direction } : { destination: direction }),
      scheduledTime: `${String(Math.floor(scheduled / 60)).padStart(2, "0")}:${String(scheduled % 60).padStart(2, "0")}`,
      delay,
      platform: platform && !/^[-–—]$/.test(platform) ? platform : null,
      status: cancelled
        ? "cancelled"
        : nearNow
          ? type === "arrivals"
            ? "incoming"
            : "departing"
          : null,
      info:
        [line && line !== "-" ? `Line ${line}` : "", via ? `Via ${via}` : ""]
          .filter(Boolean)
          .join(" · ") || null,
    });
  }

  const selector = `#${section} .dataGridst`;
  await new HTMLRewriter()
    .on(`#${section}`, {
      element() {
        foundSection = true;
      },
    })
    .on(selector, {
      element() {
        finishRow();
        cells = [];
        fullWidthNote = false;
      },
    })
    .on(`${selector} > div`, {
      element(element) {
        cells?.push("");
        if (element.getAttribute("class")?.split(/\s+/).includes("col-lg-12")) fullWidthNote = true;
      },
      text(chunk) {
        if (cells?.length) cells[cells.length - 1] += chunk.text;
      },
    })
    .transform(new Response(html))
    .text();
  finishRow();
  if (!foundSection) {
    throw new ScraperError("The Czech train data source returned an invalid station board.", 502);
  }
  // GRAPP already orders each section chronologically, including across midnight.
  const seen = new Set<string>();
  return trains
    .filter((train) => {
      const key = `${train.trainNumber}|${train.scheduledTime}|${train.origin ?? train.destination}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

export async function scrapeCzechTrains(
  stationId: string,
  type: BoardType = "departures",
): Promise<ScrapeResult> {
  const code = stationId.match(/^CZ(\d{7})$/)?.[1];
  const internalId = code ? CODES[code] : undefined;
  if (internalId === undefined) throw new ScraperError("Unknown Czech station ID.", 404);

  // The token is tied to the ASP.NET session from this exact homepage response.
  // Keep both request-local; never reuse one visitor's session across Worker requests.
  const home = await fetchTextWithTimeout(`${BASE_URL}/`, "Czech");
  const token = home.text.match(/<input\b[^>]*\bid="token"[^>]*\bvalue="([\da-f]+)"/i)?.[1];
  const cookie = home.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .find((value) => value?.startsWith("ASP.NET_SessionId="));
  if (!token || !cookie) {
    throw new ScraperError("Unable to establish a session with the Czech train data source.", 502, {
      fetchMs: home.fetchMs,
    });
  }
  const board = await fetchTextWithTimeout(
    `${BASE_URL}/OneTrain/StationInfo/${token}?stationId=${internalId}`,
    "Czech",
    { headers: { Cookie: cookie } },
  );
  const fetchMs = home.fetchMs + board.fetchMs;
  try {
    return { trains: await parseBoard(board.text, type), info: SOURCE_NOTE, timing: { fetchMs } };
  } catch (error) {
    if (error instanceof ScraperError) {
      throw new ScraperError(error.message, error.statusCode, { fetchMs }, { cause: error });
    }
    throw error;
  }
}
