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
