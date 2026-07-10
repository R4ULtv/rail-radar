import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Train } from "@repo/data";

export interface ScraperTiming {
  fetchMs: number;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode,
    public timing?: ScraperTiming,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

export interface ScrapeResult {
  trains: Train[];
  info: string | null;
  timing: ScraperTiming;
}

export function formatTime(isoString: string | null, timeZone: string): string {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

export const STATUS_WINDOW_MS = 5 * 60 * 1000;

export const SHORT_STATUS_WINDOW_MS = 3 * 60 * 1000;

const BRAND_MAP: Record<string, string> = {
  EUR: "Eurostar",
  ICE: "DB",
  TGV: "SNCF",
  THA: "Thalys",
};

/** "CH8503000" -> "8503000". Strips a leading uppercase-letter country prefix. */
export function stripCountryPrefix(stationId: string): string {
  return stationId.replace(/^[A-Z]+/, "");
}

export function statusFromWindow(
  actualTimeMs: number,
  now: number,
  windowMs: number,
  type: "arrivals" | "departures",
): "incoming" | "departing" | null {
  if (actualTimeMs >= now - windowMs && actualTimeMs <= now + windowMs) {
    return type === "departures" ? "departing" : "incoming";
  }
  return null;
}

export function dedupeSortLimit<T>(
  items: T[],
  keyFn: (item: T) => string,
  compareFn: (a: T, b: T) => number,
  limit: number,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items.slice().sort(compareFn)) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export function resolveBrand(
  code: string | null | undefined,
  fallback: Train["brand"],
): Train["brand"] {
  const normalized = code?.trim().toUpperCase();
  return normalized ? (BRAND_MAP[normalized] ?? fallback) : fallback;
}
