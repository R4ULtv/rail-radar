import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrapeBelgiumTrains } from "../../src/scrapers/belgium";
import { ScraperError } from "../../src/scrapers/core";
import {
  epochSecondsFromNow,
  freezeTime,
  jsonResponse,
  mockFetch,
  type FetchMock,
} from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Brussels (CET)

type Entry = {
  station: string;
  time: string;
  delay: string;
  canceled: string;
  left?: string;
  arrived?: string;
  vehicle: string;
  vehicleinfo: { shortname: string; number: string; type: string };
  platform: string;
  platforminfo: { name: string; normal: string };
};

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    station: "Brussels-South/Brussels-Midi",
    time: String(epochSecondsFromNow(20)),
    delay: "0",
    canceled: "0",
    left: "0",
    arrived: "0",
    vehicle: "BE.NMBS.IC2117",
    vehicleinfo: { shortname: "IC 2117", number: "2117", type: "IC" },
    platform: "3",
    platforminfo: { name: "3", normal: "1" },
    ...overrides,
  };
}

describe("scrapeBelgiumTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the iRail liveboard with the converted station id", async () => {
    fetchMock.on("api.irail.be", jsonResponse({ departures: { departure: [] } }));

    await scrapeBelgiumTrains("BE95000", "departures");

    const url = fetchMock.url();
    expect(url.origin + url.pathname).toBe("https://api.irail.be/v1/liveboard/");
    expect(url.searchParams.get("id")).toBe("BE.NMBS.008895000");
    expect(url.searchParams.get("arrdep")).toBe("departure");
    expect(url.searchParams.get("format")).toBe("json");
  });

  it("asks for arrivals when requested", async () => {
    fetchMock.on("api.irail.be", jsonResponse({ arrivals: { arrival: [] } }));

    await scrapeBelgiumTrains("BE95000", "arrivals");

    expect(fetchMock.url().searchParams.get("arrdep")).toBe("arrival");
  });

  it("maps departures to trains", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({
        departures: {
          departure: [
            entry({
              station: "Antwerp-Central",
              time: String(Date.parse("2026-03-10T09:20:00Z") / 1000),
              delay: "180",
            }),
          ],
        },
      }),
    );

    const result = await scrapeBelgiumTrains("BE95000", "departures");

    expect(result.info).toBeNull();
    expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
    expect(result.trains).toEqual([
      {
        brand: "SNCB",
        category: "IC",
        trainNumber: "2117",
        destination: "Antwerp-Central",
        scheduledTime: "10:20",
        delay: 3,
        platform: "3",
        status: null,
        info: null,
      },
    ]);
  });

  it("uses origin instead of destination for arrivals", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({ arrivals: { arrival: [entry({ station: "Liège-Guillemins" })] } }),
    );

    const [train] = (await scrapeBelgiumTrains("BE95000", "arrivals")).trains;

    expect(train?.origin).toBe("Liège-Guillemins");
    expect(train).not.toHaveProperty("destination");
  });

  it("maps known international vehicle types to their brand", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({
        departures: {
          departure: [
            entry({ vehicleinfo: { shortname: "EUR 9316", number: "9316", type: "EUR" } }),
            entry({ vehicleinfo: { shortname: "ICE 15", number: "15", type: "ICE" } }),
          ],
        },
      }),
    );

    const { trains } = await scrapeBelgiumTrains("BE95000");

    expect(trains.map((train) => train.brand)).toEqual(["Eurostar", "DB"]);
  });

  it("derives status from cancellation, departure flags and the 5-minute window", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({
        departures: {
          departure: [
            entry({ canceled: "1" }),
            entry({ left: "1", time: String(epochSecondsFromNow(-2)) }),
            entry({ time: String(epochSecondsFromNow(4)) }),
            // Scheduled 10 minutes ago but 8 minutes late: now 2 minutes away.
            entry({ time: String(epochSecondsFromNow(-10)), delay: "480" }),
            entry({ time: String(epochSecondsFromNow(30)) }),
          ],
        },
      }),
    );

    const { trains } = await scrapeBelgiumTrains("BE95000");

    expect(trains.map((train) => train.status)).toEqual([
      "cancelled",
      "departing",
      "departing",
      "departing",
      null,
    ]);
  });

  it("drops trains that left more than 5 minutes ago unless flagged", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({
        departures: {
          departure: [
            entry({
              vehicleinfo: { shortname: "", number: "1", type: "IC" },
              time: String(epochSecondsFromNow(-20)),
            }),
            entry({
              vehicleinfo: { shortname: "", number: "2", type: "IC" },
              time: String(epochSecondsFromNow(-20)),
              canceled: "1",
            }),
            entry({
              vehicleinfo: { shortname: "", number: "3", type: "IC" },
              time: "not-a-number",
            }),
            entry({ vehicleinfo: { shortname: "", number: "4", type: "IC" } }),
          ],
        },
      }),
    );

    const { trains } = await scrapeBelgiumTrains("BE95000");

    expect(trains.map((train) => train.trainNumber)).toEqual(["2", "4"]);
  });

  it("keeps at most 16 entries from the board", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({ departures: { departure: Array.from({ length: 25 }, () => entry()) } }),
    );

    const { trains } = await scrapeBelgiumTrains("BE95000");

    expect(trains).toHaveLength(16);
  });

  it("falls back to the raw platform and nulls empty values", async () => {
    fetchMock.on(
      "api.irail.be",
      jsonResponse({
        departures: {
          departure: [
            entry({ platforminfo: { name: "", normal: "1" }, platform: "12" }),
            entry({
              platforminfo: { name: "", normal: "1" },
              platform: "",
              vehicleinfo: { shortname: "", number: "9", type: "" },
            }),
          ],
        },
      }),
    );

    const { trains } = await scrapeBelgiumTrains("BE95000");

    expect(trains[0]?.platform).toBe("12");
    expect(trains[1]).toMatchObject({ platform: null, category: null, brand: "SNCB", delay: null });
  });

  it("returns an empty board when the response has no departures or arrivals", async () => {
    fetchMock.on("api.irail.be", jsonResponse({}));

    await expect(scrapeBelgiumTrains("BE95000")).resolves.toMatchObject({ trains: [], info: null });
  });

  it("wraps upstream HTTP errors in a ScraperError", async () => {
    fetchMock.on("api.irail.be", jsonResponse({ error: "busy" }, { status: 503 }));

    const error = await scrapeBelgiumTrains("BE95000").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("Belgian"),
      upstream: { host: "api.irail.be", status: 503 },
    });
  });
});
