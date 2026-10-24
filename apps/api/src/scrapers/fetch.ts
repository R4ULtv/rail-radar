import type { ContentfulStatusCode } from "hono/utils/http-status";

import { FETCH_TIMEOUT_MS } from "../constants";
import { ScraperError, type ScraperUpstream } from "./core";

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
  upstream: ScraperUpstream;
}> {
  const parsedUrl = new URL(url);
  const upstream: ScraperUpstream = { host: parsedUrl.host, path: parsedUrl.pathname, timeoutMs };
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
      throw timeoutError(regionLabel, fetchMs, upstream, error);
    }
    throw new ScraperError(
      `Unable to connect to the ${regionLabel} train data source. Please try again.`,
      502,
      { fetchMs },
      { cause: error, upstream },
    );
  }

  const fetchMs = performance.now() - startTime;

  if (!response.ok) {
    clearTimeout(timeoutId);
    throw new ScraperError(
      upstreamHttpErrorMessage(regionLabel, response.status),
      response.status as ContentfulStatusCode,
      { fetchMs },
      { upstream: { ...upstream, status: response.status } },
    );
  }

  return {
    response,
    fetchMs,
    startTime,
    timeoutId,
    upstream: { ...upstream, status: response.status },
  };
}

function upstreamHttpErrorMessage(regionLabel: string, status: number): string {
  const source = `The ${regionLabel} train data source`;
  const httpStatus = `(HTTP ${status})`;

  switch (status) {
    case 408:
    case 504:
      return `${source} timed out ${httpStatus}. Please try again.`;
    case 429:
      return `${source} has reached its request limit ${httpStatus}. Please try again shortly.`;
    case 401:
    case 403:
      return `${source} rejected our access ${httpStatus}.`;
    case 404:
      return `${source} could not find the requested train data ${httpStatus}.`;
    default:
      return status >= 500
        ? `${source} is temporarily unavailable ${httpStatus}. Please try again.`
        : `${source} rejected the request ${httpStatus}.`;
  }
}

function timeoutError(
  regionLabel: string,
  fetchMs: number,
  upstream: ScraperUpstream,
  cause: unknown,
) {
  return new ScraperError(
    `The ${regionLabel} train data source is taking too long to respond. Please try again.`,
    504,
    { fetchMs },
    { cause, upstream },
  );
}

async function readBody<T>(
  read: () => Promise<T>,
  regionLabel: string,
  startTime: number,
  timeoutId: ReturnType<typeof setTimeout>,
  upstream: ScraperUpstream,
): Promise<{ value: T; fetchMs: number }> {
  try {
    const value = await read();
    return { value, fetchMs: performance.now() - startTime };
  } catch (error) {
    const fetchMs = performance.now() - startTime;
    if (error instanceof Error && error.name === "AbortError") {
      throw timeoutError(regionLabel, fetchMs, upstream, error);
    }
    throw new ScraperError(
      error instanceof SyntaxError
        ? `The ${regionLabel} train data source returned an invalid response. Please try again.`
        : `Unable to read the response from the ${regionLabel} train data source. Please try again.`,
      502,
      { fetchMs },
      { cause: error, upstream },
    );
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
  const { response, startTime, timeoutId, upstream } = await fetchResponseWithTimeout(
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
    upstream,
  );
  return { data: value, fetchMs };
}

export async function fetchTextWithTimeout(
  url: string,
  regionLabel: string,
  options?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{ text: string; fetchMs: number }> {
  const { response, startTime, timeoutId, upstream } = await fetchResponseWithTimeout(
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
    upstream,
  );
  return { text: value, fetchMs };
}
