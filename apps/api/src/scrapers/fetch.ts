import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError } from "./index";

export async function fetchWithTimeout(
  url: string,
  regionLabel: string,
  options?: RequestInit,
): Promise<{ response: Response; fetchMs: number }> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const fetchError = error instanceof Error ? error : new Error(String(error));
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    if (fetchError.name === "AbortError") {
      throw new ScraperError(
        `The ${regionLabel} train data source is taking too long to respond. Please try again.`,
        504,
        { fetchMs },
      );
    }
    throw new ScraperError(
      `Unable to connect to the ${regionLabel} train data source. Please try again.`,
      502,
      { fetchMs },
    );
  }

  const fetchMs = performance.now() - startTime;
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
      { fetchMs },
    );
  }

  return { response, fetchMs };
}
