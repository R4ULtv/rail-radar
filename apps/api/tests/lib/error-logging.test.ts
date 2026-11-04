import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { Env } from "../../src/lib/env";
import { logRequestError, logRequestWarning } from "../../src/lib/error-logging";
import { ScraperError } from "../../src/scrapers/core";
import { captureLogs } from "../helpers";

function appThatLogs(error: unknown, level: "error" | "warn") {
  return new Hono<Env>().get("/stations/:id", (c) => {
    c.set("requestId", "req-123");
    c.set("requestStartedAt", performance.now());
    if (level === "error") logRequestError(c, error, "Something failed", { stationId: "IT1" });
    else logRequestWarning(c, error, "Something degraded");
    return c.text("ok");
  });
}

describe("logRequestError", () => {
  it("writes one structured JSON line and sets X-Request-Id", async () => {
    const logs = captureLogs();

    const response = await appThatLogs(new Error("boom"), "error").request(
      "https://api.test/stations/IT1?type=arrivals",
    );

    expect(response.headers.get("X-Request-Id")).toBe("req-123");
    expect(logs.errors()).toEqual([
      expect.objectContaining({
        message: "Something failed",
        service: "api",
        requestId: "req-123",
        method: "GET",
        path: "/stations/IT1",
        route: "/stations/:id",
        status: 500,
        stationId: "IT1",
        durationMs: expect.any(Number),
        error: expect.objectContaining({ name: "Error", message: "boom" }),
      }),
    ]);
  });

  it("includes scraper status, timing and upstream metadata", async () => {
    const logs = captureLogs();
    const error = new ScraperError(
      "Upstream down",
      503,
      { fetchMs: 42 },
      {
        upstream: { host: "api.irail.be", path: "/v1/liveboard/", status: 503 },
      },
    );

    await appThatLogs(error, "error").request("https://api.test/stations/BE1");

    expect(logs.errors()[0]).toMatchObject({
      status: 503,
      fetchMs: 42,
      upstream: { host: "api.irail.be", path: "/v1/liveboard/", status: 503 },
      error: { name: "ScraperError", message: "Upstream down" },
    });
  });

  it("strips query strings (credentials) from URLs in messages, stacks and causes", async () => {
    const logs = captureLogs();
    const cause = new Error("GET https://upstream.test/board?apiKey=SECRET failed");
    const error = new Error("Wrapped https://other.test/x?token=SECRET2", { cause });

    await appThatLogs(error, "error").request("https://api.test/stations/IT1");

    const line = JSON.stringify(logs.errors()[0]);
    expect(line).not.toContain("SECRET");
    expect(logs.errors()[0]).toMatchObject({
      error: {
        message: "Wrapped https://other.test/x",
        cause: { message: "GET https://upstream.test/board failed" },
      },
    });
  });

  it("describes non-Error values", async () => {
    const logs = captureLogs();

    await appThatLogs("plain failure", "error").request("https://api.test/stations/IT1");

    expect(logs.errors()[0]).toMatchObject({
      error: { name: "UnknownError", message: "plain failure" },
    });
  });

  it("limits cause chains to three levels", async () => {
    const logs = captureLogs();
    let error = new Error("level 0");
    for (let i = 1; i <= 5; i++) error = new Error(`level ${i}`, { cause: error });

    await appThatLogs(error, "error").request("https://api.test/stations/IT1");

    const logged = logs.errors()[0]!.error as { cause?: unknown };
    let depth = 0;
    for (let node = logged; node.cause; node = node.cause as { cause?: unknown }) depth++;
    expect(depth).toBe(3);
  });
});

describe("logRequestWarning", () => {
  it("logs at warn level without touching the response headers", async () => {
    const logs = captureLogs();

    const response = await appThatLogs(new Error("cache down"), "warn").request(
      "https://api.test/stations/IT1",
    );

    expect(response.headers.get("X-Request-Id")).toBeNull();
    expect(logs.errors()).toEqual([]);
    expect(logs.warnings()[0]).toMatchObject({ message: "Something degraded" });
  });
});
