import type { Train } from "@repo/data";

import {
  STATUS_WINDOW_MS,
  ScraperError,
  type ScrapeResult,
  resolveBrand,
  statusFromWindow,
} from "./core";
import { fetchTextWithTimeout } from "./fetch";

const DB_BASE_URL = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";
const TRAIN_LIMIT = 24;
// Berlin's public ID denotes the station group. Its through platforms use this
// verified Timetables EVA; selecting one section keeps each cold load to two calls.
const EVA_OVERRIDES: Record<string, string> = { DE11160: "8098160" };
const NON_RAIL_CATEGORIES = new Set(["BUS", "SEV", "SCHIFF", "STR", "U", "UBAHN"]);
const BOARD_WINDOW_MS = 2 * 60 * 60 * 1000;

// DB Timetables uses attribute-based XML. Keep this parser scoped to that format;
// in particular, nested connection/reference stops must not become board rows.
interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
}

export interface TimetableEvent {
  attributes: Record<string, string>;
  messages: Record<string, string>[];
}

export interface TimetableStop {
  id: string;
  label: Record<string, string>;
  arrival?: TimetableEvent;
  departure?: TimetableEvent;
  messages: Record<string, string>[];
}

export interface Timetable {
  stops: TimetableStop[];
  messages: Record<string, string>[];
}

function decodeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g, (_, entity: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (!entity.startsWith("#")) return named[entity]!;
    const code = entity.startsWith("#x")
      ? parseInt(entity.slice(2), 16)
      : parseInt(entity.slice(1), 10);
    if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      throw new Error("Invalid XML character reference.");
    }
    return String.fromCodePoint(code);
  });
}

function parseXml(xml: string, rootName: string): XmlElement {
  const document: XmlElement = { name: "", attributes: {}, children: [] };
  const stack = [document];
  // Quoted attribute values can contain '>'; a tag ends only outside quotes.
  const tokens =
    xml.match(
      /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>|[^<]+/g,
    ) ?? [];
  if (tokens.join("") !== xml) throw new Error("Malformed Timetables XML.");

  for (const token of tokens) {
    if (token.startsWith("<?") || token.startsWith("<!--")) continue;
    if (!token.startsWith("<")) {
      if (token.trim()) throw new Error("Unexpected text in Timetables XML.");
      continue;
    }
    if (token.startsWith("<!")) throw new Error("XML declarations are not supported.");
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      if (stack.length < 2 || stack.pop()!.name !== name) {
        throw new Error("Unbalanced Timetables XML.");
      }
      continue;
    }

    const tag = token.slice(1, token.endsWith("/>") ? -2 : -1).trim();
    const name = tag.match(/^[\w:-]+/)?.[0];
    if (!name) throw new Error("Invalid XML element.");
    const element: XmlElement = { name, attributes: Object.create(null), children: [] };
    const attributes = tag.slice(name.length);
    const pattern = /\s+([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let end = 0;
    for (const match of attributes.matchAll(pattern)) {
      if (attributes.slice(end, match.index).trim()) throw new Error("Invalid XML attribute.");
      element.attributes[match[1]!] = decodeXml(match[2] ?? match[3] ?? "");
      end = match.index + match[0].length;
    }
    if (attributes.slice(end).trim()) throw new Error("Invalid XML attributes.");
    stack.at(-1)!.children.push(element);
    if (!token.endsWith("/>")) stack.push(element);
    if (stack.length > 32) throw new Error("Timetables XML is nested too deeply.");
  }

  const root = document.children[0];
  if (stack.length !== 1 || document.children.length !== 1 || root?.name !== rootName) {
    throw new Error("Invalid Timetables XML root.");
  }
  return root;
}

function messages(element: XmlElement): Record<string, string>[] {
  return element.children.filter((child) => child.name === "m").map((child) => child.attributes);
}

function event(element: XmlElement | undefined): TimetableEvent | undefined {
  return element ? { attributes: element.attributes, messages: messages(element) } : undefined;
}

export function parseTimetable(xml: string): Timetable {
  const root = parseXml(xml, "timetable");
  return {
    messages: messages(root),
    stops: root.children
      .filter((child) => child.name === "s")
      .map((stop) => {
        if (!stop.attributes.id) throw new Error("Timetable stop has no ID.");
        return {
          id: stop.attributes.id,
          label: stop.children.find((child) => child.name === "tl")?.attributes ?? {},
          arrival: event(stop.children.find((child) => child.name === "ar")),
          departure: event(stop.children.find((child) => child.name === "dp")),
          messages: messages(stop),
        };
      }),
  };
}

function mergeMessages(
  planned: Record<string, string>[],
  changed: Record<string, string>[],
): Record<string, string>[] {
  const merged = new Map(
    planned.map((message, index) => [message.id ?? `planned-${index}`, message]),
  );
  for (const [index, message] of changed.entries()) {
    merged.set(message.id ?? `changed-${index}`, message);
  }
  return [...merged.values()].filter((message) => message.del !== "1");
}

function mergeEvent(
  planned: TimetableEvent | undefined,
  changed: TimetableEvent | undefined,
): TimetableEvent | undefined {
  if (!planned) return changed;
  if (!changed) return planned;
  return {
    attributes: { ...planned.attributes, ...changed.attributes },
    messages: mergeMessages(planned.messages, changed.messages),
  };
}

export function mergeTimetables(plans: Timetable[], changes: Timetable): Timetable {
  const stops = new Map<string, TimetableStop>();
  for (const timetable of [...plans, changes]) {
    for (const stop of timetable.stops) {
      const planned = stops.get(stop.id);
      stops.set(
        stop.id,
        planned
          ? {
              id: stop.id,
              label: { ...planned.label, ...stop.label },
              arrival: mergeEvent(planned.arrival, stop.arrival),
              departure: mergeEvent(planned.departure, stop.departure),
              messages: mergeMessages(planned.messages, stop.messages),
            }
          : stop,
      );
    }
  }
  return { stops: [...stops.values()], messages: changes.messages };
}

const berlinFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatDbTime(time: number): string {
  const parts = berlinFormatter.formatToParts(time);
  return ["year", "month", "day", "hour", "minute"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("");
}

export function parseDbTime(value: string | undefined, reference: number): number {
  if (!value || !/^\d{10}$/.test(value)) return NaN;
  const local = Date.UTC(
    2000 + Number(value.slice(0, 2)),
    Number(value.slice(2, 4)) - 1,
    Number(value.slice(4, 6)),
    Number(value.slice(6, 8)),
    Number(value.slice(8, 10)),
  );
  // Berlin is UTC+1 or UTC+2. Round trips reject invalid dates and the spring
  // clock gap; near the repeated autumn hour choose the closest occurrence.
  const candidates = [local - 3_600_000, local - 7_200_000].filter(
    (time) => formatDbTime(time) === value,
  );
  candidates.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference));
  return candidates[0] ?? NaN;
}

export function getMessageText(items: Record<string, string>[]): string | null {
  const texts = items
    .filter((message) => message.del !== "1")
    .map((message) => message.ext?.trim())
    .filter((text): text is string => Boolean(text));
  // DB's `int` field is internal text, not a public passenger message.
  return [...new Set(texts)].join("; ") || null;
}

function getBrand(category: string): string | null {
  const local: Record<string, string> = {
    FLX: "FlixTrain",
    ARV: "Arriva",
    BRB: "Transdev",
    HLB: "HLB",
    OE: "ODEG",
    STN: "STB",
    VIA: "Vias",
    WB: "WestfalenBahn",
    VLX: "Vogtlandbahn",
    RJX: "OBB",
    RJ: "OBB",
    NJ: "OBB",
  };
  return local[category.toUpperCase()] ?? resolveBrand(category, "DB");
}

async function readXml(
  path: string,
  headers: Record<string, string>,
  cache: Cache | undefined,
  accountCacheKey: string,
): Promise<string> {
  // Authentication is used only for the upstream request, never in cache URLs.
  const cacheKey = `https://api.railradar24.com/__internal/db-timetables/v1/${accountCacheKey}/${path}`;
  try {
    const cached = await cache?.match(cacheKey);
    if (cached?.ok) {
      const xml = await cached.text();
      parseTimetable(xml);
      return xml;
    }
  } catch {
    // A cache failure or invalid cached response must not prevent a fresh fetch.
  }

  let xml: string;
  try {
    const result = await fetchTextWithTimeout(`${DB_BASE_URL}/${path}`, "German", { headers });
    xml = result.text;
  } catch (error) {
    if (!(error instanceof ScraperError)) throw error;
    console.warn("[DB Timetables] Upstream request failed", {
      path,
      status: error.statusCode,
    });
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw new ScraperError("DB Timetables credentials were rejected.", 503, error.timing, {
        cause: error,
        upstream: error.upstream,
      });
    }
    if (error.statusCode === 429) {
      throw new ScraperError(
        "The German train data source has reached its request limit. Please try again shortly.",
        503,
        error.timing,
        { cause: error, upstream: error.upstream },
      );
    }
    if (error.statusCode === 404 && path.startsWith("plan/")) {
      // A station may have no published plan for an hourly slice. Do not cache
      // this response: the plan may become available on the next request.
      return "<timetable/>";
    }
    if (error.statusCode === 404) {
      throw new ScraperError("This station is not supported by DB Timetables.", 404, error.timing, {
        cause: error,
        upstream: error.upstream,
      });
    }
    if (error.statusCode === 504) throw error;
    throw new ScraperError(
      "Unable to load German train data. Please try again.",
      502,
      error.timing,
      { cause: error, upstream: error.upstream },
    );
  }

  try {
    parseTimetable(xml);
  } catch (error) {
    throw new ScraperError("Invalid response from DB Timetables.", 502, undefined, {
      cause: error,
    });
  }

  const ttl = path.startsWith("fchg/") ? 30 : 86_400;
  // Retry empty plans shortly: they may not have been published yet.
  const maxAge = path.startsWith("plan/") && parseTimetable(xml).stops.length === 0 ? 60 : ttl;
  try {
    await cache?.put(
      cacheKey,
      new Response(xml, {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": `public, max-age=${maxAge}`,
        },
      }),
    );
  } catch {
    // Return the successful upstream result even when the cache is unavailable.
  }
  return xml;
}

function toBoardEntry(
  stop: TimetableStop,
  type: "arrivals" | "departures",
  now: number,
): { train: Train; time: number; id: string } | null {
  const event = type === "departures" ? stop.departure : stop.arrival;
  if (!event || event.attributes.hi === "1") return null;
  const category = stop.label.c?.trim() ?? "";
  if (!category || !stop.label.n || NON_RAIL_CATEGORIES.has(category.toUpperCase())) return null;
  const attributes = event.attributes;
  const scheduled = parseDbTime(attributes.pt, now);
  if (!Number.isFinite(scheduled)) return null;
  const changed = parseDbTime(attributes.ct, scheduled);
  const cancelled = (attributes.cs ?? attributes.ps) === "c";
  const actual = Number.isFinite(changed) ? changed : scheduled;
  const boardTime = cancelled ? scheduled : actual;
  if (boardTime < now - STATUS_WINDOW_MS || boardTime > now + BOARD_WINDOW_MS) return null;

  const path = (attributes.cpth ?? attributes.ppth ?? "").split("|").filter(Boolean);
  const direction =
    attributes.cde || attributes.pde || (type === "departures" ? path.at(-1) : path[0]);
  if (!direction) return null;
  const train: Train = {
    brand: getBrand(category),
    category: category || null,
    trainNumber: stop.label.n ?? "",
    scheduledTime: `${attributes.pt!.slice(6, 8)}:${attributes.pt!.slice(8, 10)}`,
    delay:
      Number.isFinite(changed) && changed > scheduled
        ? Math.round((changed - scheduled) / 60_000)
        : null,
    platform: attributes.cp ?? attributes.pp ?? null,
    status: cancelled ? "cancelled" : statusFromWindow(actual, now, STATUS_WINDOW_MS, type),
    info: getMessageText([...stop.messages, ...event.messages]),
    ...(type === "departures" ? { destination: direction } : { origin: direction }),
  };
  return { train, time: scheduled, id: stop.id };
}

export async function scrapeGermanTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
  env?: Record<string, unknown>,
): Promise<ScrapeResult> {
  const clientId = env?.DB_CLIENT_ID;
  const apiKey = env?.DB_API_KEY;
  if (typeof clientId !== "string" || !clientId || typeof apiKey !== "string" || !apiKey) {
    throw new ScraperError("DB Timetables credentials are not configured.", 500);
  }
  // Preserve public station IDs. Short/legacy entries need an explicit verified
  // mapping; padding them could select an unrelated station.
  if (!/^DE\d{5}$/.test(stationId)) {
    throw new ScraperError("This station has no verified German EVA identifier.", 404);
  }

  const start = performance.now();
  const now = Date.now();
  const eva = EVA_OVERRIDES[stationId] ?? `80${stationId.slice(2)}`;
  const headers = { "DB-Client-ID": clientId, "DB-Api-Key": apiKey, Accept: "application/xml" };
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientId));
  const accountCacheKey = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  let cache: Cache | undefined;
  try {
    cache = await caches.open("db-timetables");
  } catch {
    // Also allows local scraper execution without a Workers Cache API.
  }
  const load = (path: string) => readXml(path, headers, cache, accountCacheKey);
  const slice = formatDbTime(now).slice(0, 8);
  // One current-hour plan plus one full change set. No station discovery or
  // section/hour fan-out on the request path; both directions share these caches.
  const [plan, changes] = await Promise.all([
    load(`plan/${eva}/${slice.slice(0, 6)}/${slice.slice(6)}`),
    load(`fchg/${eva}`),
  ]);
  const timetable: Timetable = mergeTimetables([parseTimetable(plan)], parseTimetable(changes));

  const entries = timetable.stops
    .map((stop) => toBoardEntry(stop, type, now))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.time - b.time);
  const seen = new Set<string>();
  const trains: Train[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    trains.push(entry.train);
  }

  // Preserve the existing display of arrival services with multiple origins.
  const arrivals = new Map<string, Train>();
  if (type === "arrivals") {
    for (const train of trains) {
      const key = JSON.stringify([
        train.brand,
        train.category,
        train.trainNumber,
        train.scheduledTime,
        train.delay,
        train.platform,
        train.status,
        train.info,
      ]);
      const existing = arrivals.get(key);
      if (existing) {
        const origins = new Set([...(existing.origin?.split(" / ") ?? []), train.origin!]);
        existing.origin = [...origins].join(" / ");
      } else {
        arrivals.set(key, { ...train });
      }
    }
  }

  return {
    trains: (type === "arrivals" ? [...arrivals.values()] : trains).slice(0, TRAIN_LIMIT),
    info: getMessageText(timetable.messages),
    timing: { fetchMs: performance.now() - start },
  };
}
