import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError } from "./core";

async function fetchResponseWithTimeout(
  url: string,
  regionLabel: string,
  options?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{
  response: Response;
  fetchMs: number;
  startTime: number;
  timeoutId: ReturnType<typeof setTimeout>;
}> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const fetchError = error instanceof Error ? error : new Error(String(error));
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    if (fetchError.name === "AbortError") {
      throw timeoutError(regionLabel, fetchMs);
    }
    throw new ScraperError(
      `Unable to connect to the ${regionLabel} train data source. Please try again.`,
      502,
      { fetchMs },
    );
  }

  const fetchMs = performance.now() - startTime;

  if (!response.ok) {
    clearTimeout(timeoutId);
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
      { fetchMs },
    );
  }

  return { response, fetchMs, startTime, timeoutId };
}

function timeoutError(regionLabel: string, fetchMs: number) {
  return new ScraperError(
    `The ${regionLabel} train data source is taking too long to respond. Please try again.`,
    504,
    { fetchMs },
  );
}

async function readBody<T>(
  read: () => Promise<T>,
  regionLabel: string,
  startTime: number,
  timeoutId: ReturnType<typeof setTimeout>,
): Promise<{ value: T; fetchMs: number }> {
  try {
    const value = await read();
    return { value, fetchMs: performance.now() - startTime };
  } catch (error) {
    const fetchMs = performance.now() - startTime;
    if (error instanceof Error && error.name === "AbortError") {
      throw timeoutError(regionLabel, fetchMs);
    }
    throw error; // malformed-body errors keep today's behavior (generic 500 path)
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  regionLabel: string,
  options?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{ data: T; fetchMs: number }> {
  const { response, startTime, timeoutId } = await fetchResponseWithTimeout(
    url,
    regionLabel,
    options,
    timeoutMs,
  );
  const { value, fetchMs } = await readBody(
    () => response.json() as Promise<T>,
    regionLabel,
    startTime,
    timeoutId,
  );
  return { data: value, fetchMs };
}

export async function fetchTextWithTimeout(
  url: string,
  regionLabel: string,
  options?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{ text: string; fetchMs: number }> {
  const { response, startTime, timeoutId } = await fetchResponseWithTimeout(
    url,
    regionLabel,
    options,
    timeoutMs,
  );
  const { value, fetchMs } = await readBody(
    () => response.text(),
    regionLabel,
    startTime,
    timeoutId,
  );
  return { text: value, fetchMs };
}
