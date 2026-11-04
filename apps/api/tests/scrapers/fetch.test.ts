import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FETCH_TIMEOUT_MS } from "../../src/constants";
import { ScraperError } from "../../src/scrapers/core";
import { fetchJsonWithTimeout, fetchTextWithTimeout } from "../../src/scrapers/fetch";
import { hang, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const URL_ = "https://upstream.example/board/departures?station=1&key=secret";

async function catchError(promise: Promise<unknown>): Promise<ScraperError> {
  const error = await promise.catch((error: unknown) => error);
  expect(error).toBeInstanceOf(ScraperError);
  return error as ScraperError;
}

describe("fetchJsonWithTimeout", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns parsed JSON with the fetch duration", async () => {
    fetchMock.on("upstream.example", jsonResponse({ ok: true }));

    const result = await fetchJsonWithTimeout<{ ok: boolean }>(URL_, "Test");

    expect(result.data).toEqual({ ok: true });
    expect(result.fetchMs).toBeGreaterThanOrEqual(0);
  });

  it("forwards request options and an abort signal", async () => {
    fetchMock.on("upstream.example", jsonResponse({}));

    await fetchJsonWithTimeout(URL_, "Test", { headers: { "X-Key": "abc" }, method: "POST" });

    const [, init] = fetchMock.fetch.mock.calls[0]!;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.requests[0]).toMatchObject({ method: "POST" });
    expect(fetchMock.requests[0]?.headers.get("X-Key")).toBe("abc");
  });

  it.each([
    [404, "could not find the requested train data (HTTP 404)."],
    [401, "rejected our access (HTTP 401)."],
    [403, "rejected our access (HTTP 403)."],
    [429, "has reached its request limit (HTTP 429). Please try again shortly."],
    [408, "timed out (HTTP 408). Please try again."],
    [504, "timed out (HTTP 504). Please try again."],
    [500, "is temporarily unavailable (HTTP 500). Please try again."],
    [503, "is temporarily unavailable (HTTP 503). Please try again."],
    [400, "rejected the request (HTTP 400)."],
  ])("maps HTTP %i to a user-facing ScraperError", async (status, message) => {
    fetchMock.on("upstream.example", textResponse("nope", { status }));

    const error = await catchError(fetchJsonWithTimeout(URL_, "Test"));

    expect(error.statusCode).toBe(status);
    expect(error.message).toBe(`The Test train data source ${message}`);
    // The query string (which can hold API keys) never reaches the error metadata.
    expect(error.upstream).toEqual({
      host: "upstream.example",
      path: "/board/departures",
      status,
      timeoutMs: FETCH_TIMEOUT_MS,
    });
  });

  it("reports network failures as 502", async () => {
    const cause = new TypeError("fetch failed");
    fetchMock.fail(cause);

    const error = await catchError(fetchJsonWithTimeout(URL_, "Test"));

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe(
      "Unable to connect to the Test train data source. Please try again.",
    );
    expect(error.cause).toBe(cause);
    expect(error.upstream?.status).toBeUndefined();
  });

  it("reports invalid JSON as 502", async () => {
    fetchMock.on("upstream.example", textResponse("<html>maintenance</html>"));

    const error = await catchError(fetchJsonWithTimeout(URL_, "Test"));

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe(
      "The Test train data source returned an invalid response. Please try again.",
    );
    expect(error.cause).toBeInstanceOf(SyntaxError);
    expect(error.upstream?.status).toBe(200);
  });

  it("aborts and reports a 504 when the upstream does not answer in time", async () => {
    vi.useFakeTimers();
    fetchMock.on("upstream.example", hang);

    const pending = catchError(fetchJsonWithTimeout(URL_, "Test", undefined, 1_000));
    await vi.advanceTimersByTimeAsync(1_000);
    const error = await pending;

    expect(error.statusCode).toBe(504);
    expect(error.message).toBe(
      "The Test train data source is taking too long to respond. Please try again.",
    );
    expect(error.upstream?.timeoutMs).toBe(1_000);
  });

  it("uses the shared timeout by default", async () => {
    vi.useFakeTimers();
    fetchMock.on("upstream.example", hang);

    let settled = false;
    const pending = catchError(fetchJsonWithTimeout(URL_, "Test")).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect((await pending).statusCode).toBe(504);
  });
});

describe("fetchTextWithTimeout", () => {
  it("returns the response body as text", async () => {
    mockFetch().on("upstream.example", textResponse("<xml/>"));

    await expect(fetchTextWithTimeout(URL_, "Test")).resolves.toMatchObject({ text: "<xml/>" });
  });

  it("shares the HTTP error mapping", async () => {
    mockFetch().on("upstream.example", textResponse("", { status: 503 }));

    const error = await catchError(fetchTextWithTimeout(URL_, "Test"));
    expect(error.statusCode).toBe(503);
  });

  it("reports a body read failure as 502", async () => {
    const body = new ReadableStream({
      pull(controller) {
        controller.error(new Error("connection reset"));
      },
    });
    mockFetch().on("upstream.example", () => new Response(body));

    const error = await catchError(fetchTextWithTimeout(URL_, "Test"));

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe(
      "Unable to read the response from the Test train data source. Please try again.",
    );
  });
});
