import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeLuxembourgTrains } from "../../src/scrapers/luxembourg";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Luxembourg (CET)
const ENV = { MOBILITEIT_API_KEY: "secret-key" };

type Departure = Record<string, unknown>;

function departure(overrides: Departure = {}): Departure {
  return {
    JourneyStatus: "P",
    ProductAtStop: {
      name: "RE 3412",
      displayNumber: "3412",
      catOut: "RE",
      operatorCode: "CFL",
    },
    name: "RE 3412",
    time: "10:20:00",
    date: "2026-03-10",
    track: "3",
    direction: "Luxembourg",
    ...overrides,
  };
}

function product(overrides: Departure = {}): Departure {
  return { ProductAtStop: { displayNumber: "1", ...overrides } };
}

describe("scrapeLuxembourgTrains", () => {
  let fetchMock: FetchMock;

  const board = (...departures: Departure[]) => {
    fetchMock.on("cdt.hafas.de", jsonResponse({ Departure: departures }));
    return scrapeLuxembourgTrains("LU00001", "departures", ENV);
  };

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("requests the HAFAS departure board with the stripped station id and API key", async () => {
      fetchMock.on("cdt.hafas.de", jsonResponse({ Departure: [] }));

      await scrapeLuxembourgTrains("LU200415058", "departures", ENV);

      expect(fetchMock.requests).toHaveLength(1);
      const url = fetchMock.url();
      expect(url.origin + url.pathname).toBe(
        "https://cdt.hafas.de/opendata/apiserver/departureBoard",
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        accessId: "secret-key",
        id: "200415058",
        format: "json",
        lang: "en",
        duration: "120",
        maxJourneys: "24",
        type: "DEP",
        rtMode: "SERVER_DEFAULT",
      });
      expect(fetchMock.requests[0]?.method).toBe("GET");
    });

    it("defaults to departures", async () => {
      fetchMock.on("cdt.hafas.de", jsonResponse({}));

      await expect(scrapeLuxembourgTrains("LU00001", undefined, ENV)).resolves.toMatchObject({
        trains: [],
      });
    });

    it("rejects arrivals with 501 before touching the network", async () => {
      const error = await scrapeLuxembourgTrains("LU00001", "arrivals", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 501,
        message: expect.stringContaining("arrivals"),
      });
      expect(fetchMock.requests).toHaveLength(0);
    });

    it.each([
      ["no env", undefined],
      ["empty env", {}],
      ["empty key", { MOBILITEIT_API_KEY: "" }],
      ["non-string key", { MOBILITEIT_API_KEY: 123 }],
    ])("fails with 500 when the API key is missing (%s)", async (_label, env) => {
      const error = await scrapeLuxembourgTrains("LU00001", "departures", env).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 500,
        message: expect.stringContaining("Luxembourg"),
      });
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("response mapping", () => {
    it("maps a departure to a train", async () => {
      const result = await board(
        departure({ rtTime: "10:25:00", rtDate: "2026-03-10", rtTrack: "4", direction: "Wiltz" }),
      );

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "CFL",
          category: "RE",
          trainNumber: "3412",
          destination: "Wiltz",
          scheduledTime: "10:20",
          delay: 5,
          platform: "4",
          status: null,
          info: null,
        },
      ]);
    });

    it("reports zero delay when there is no realtime data", async () => {
      const { trains } = await board(departure());

      expect(trains[0]?.delay).toBe(0);
    });

    it("falls back to the scheduled time when the realtime time is missing", async () => {
      const { trains } = await board(departure({ rtDate: "2026-03-10" }));

      expect(trains[0]?.delay).toBe(0);
    });

    it("uses the scheduled date when the realtime time has no date", async () => {
      const { trains } = await board(departure({ rtTime: "10:22" }));

      expect(trains[0]).toMatchObject({ delay: 2, scheduledTime: "10:20" });
    });

    it("handles realtime that rolls over midnight", async () => {
      freezeTime("2026-03-10T22:50:00.000Z"); // 23:50 local
      const { trains } = await board(
        departure({
          time: "23:55:00",
          date: "2026-03-10",
          rtTime: "00:05:00",
          rtDate: "2026-03-11",
        }),
      );

      expect(trains[0]).toMatchObject({ scheduledTime: "23:55", delay: 10, status: null });
    });

    it("uses the Luxembourg date for the current time near midnight UTC", async () => {
      freezeTime("2026-07-10T22:30:00.000Z"); // 00:30 on July 11 in CEST
      const { trains } = await board(departure({ time: "00:32:00", date: "2026-07-11" }));

      expect(trains[0]).toMatchObject({ scheduledTime: "00:32", status: "departing" });
    });

    it("normalizes single-digit hours in the scheduled time", async () => {
      freezeTime("2026-03-10T07:30:00.000Z"); // 08:30 local
      const { trains } = await board(departure({ time: "9:05" }));

      expect(trains[0]?.scheduledTime).toBe("09:05");
    });

    it("skips departures with a missing or malformed date or time", async () => {
      const { trains } = await board(
        departure({ time: undefined }),
        departure({ date: undefined }),
        departure({ date: "10/03/2026" }),
        departure({ time: "soon" }),
        departure({ name: "valid", ProductAtStop: { displayNumber: "7" } }),
      );

      expect(trains.map((train) => train.trainNumber)).toEqual(["7"]);
    });

    it("prefers the realtime platform over the scheduled one", async () => {
      const { trains } = await board(
        departure({ track: "1", rtTrack: "2", platform: { text: "5" }, rtPlatform: { text: "6" } }),
        departure({
          ProductAtStop: { displayNumber: "2" },
          track: "1",
          platform: { text: "5" },
          rtPlatform: { text: "6" },
        }),
        departure({
          ProductAtStop: { displayNumber: "3" },
          track: undefined,
          platform: { text: "5" },
        }),
        departure({ ProductAtStop: { displayNumber: "4" }, track: undefined }),
      );

      expect(trains.map((train) => train.platform)).toEqual(["2", "6", "5", null]);
    });

    it("resolves the brand from the operator fields in priority order", async () => {
      const { trains } = await board(
        departure({
          ...product({
            operatorCode: "CFL",
            operatorInfo: { nameS: "S", name: "N" },
            operator: "O",
          }),
        }),
        departure({
          ...product({
            displayNumber: "2",
            operatorInfo: { nameS: "S", name: "N" },
            operator: "O",
          }),
        }),
        departure({
          ...product({ displayNumber: "3", operatorInfo: { name: "N" }, operator: "O" }),
        }),
        departure({ ...product({ displayNumber: "4", operator: "O" }) }),
        departure({ ...product({ displayNumber: "5" }) }),
      );

      expect(trains.map((train) => train.brand)).toEqual(["CFL", "S", "N", "O", null]);
    });

    it("resolves category from catOut, then line", async () => {
      const { trains } = await board(
        departure({ ...product({ catOut: "IC", line: "IC 90" }) }),
        departure({ ...product({ displayNumber: "2", catOut: undefined, line: "RB 10" }) }),
        departure({ ...product({ displayNumber: "3", catOut: undefined }) }),
      );

      expect(trains.map((train) => train.category)).toEqual(["IC", "RB 10", null]);
    });

    it("resolves the train number from several fallbacks", async () => {
      const { trains } = await board(
        departure({ ProductAtStop: { displayNumber: "1", num: "2", name: "3" }, name: "4" }),
        departure({ ProductAtStop: { num: "2", name: "3" }, name: "4" }),
        departure({ ProductAtStop: { name: "3" }, name: "4" }),
        departure({ ProductAtStop: { catOut: "RB" }, name: "4" }),
        departure({ ProductAtStop: { catOut: "RB" }, name: undefined }),
        departure({ ProductAtStop: undefined, name: undefined }),
      );

      expect(trains.map((train) => train.trainNumber)).toEqual(["1", "2", "3", "4", "RB", "—"]);
    });

    it("keeps at most 24 trains sorted by scheduled time", async () => {
      const departures = Array.from({ length: 30 }, (_, index) => {
        // Reverse order, so sorting is required to pick the earliest 24.
        const minute = 59 - index;
        return departure({
          ProductAtStop: { displayNumber: String(index) },
          time: `11:${String(minute).padStart(2, "0")}:00`,
        });
      });

      const { trains } = await board(...departures);

      expect(trains).toHaveLength(24);
      expect(trains[0]?.scheduledTime).toBe("11:30");
      expect(trains.at(-1)?.scheduledTime).toBe("11:53");
    });

    it("returns an empty board when there are no departures", async () => {
      fetchMock.on("cdt.hafas.de", jsonResponse({}));

      await expect(scrapeLuxembourgTrains("LU00001", "departures", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });
  });

  describe("status and filtering", () => {
    it("marks trains within five minutes of now as departing", async () => {
      const { trains } = await board(
        departure({ ProductAtStop: { displayNumber: "1" }, time: "09:55:00" }),
        departure({ ProductAtStop: { displayNumber: "2" }, time: "10:05:00" }),
        departure({ ProductAtStop: { displayNumber: "3" }, time: "10:06:00" }),
      );

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["1", "departing"],
        ["2", "departing"],
        ["3", null],
      ]);
    });

    it("drops departures more than five minutes in the past", async () => {
      const { trains } = await board(
        departure({ ProductAtStop: { displayNumber: "old" }, time: "09:54:00" }),
        departure({ ProductAtStop: { displayNumber: "new" }, time: "09:55:00" }),
      );

      expect(trains.map((train) => train.trainNumber)).toEqual(["new"]);
    });

    it("keeps a delayed train whose realtime is still within the window", async () => {
      const { trains } = await board(
        departure({ time: "09:50:00", rtTime: "10:02:00" }),
        departure({
          ProductAtStop: { displayNumber: "late" },
          time: "09:50:00",
          rtTime: "09:52:00",
        }),
      );

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ scheduledTime: "09:50", delay: 12, status: "departing" });
    });

    it("bases the status on the realtime time", async () => {
      const { trains } = await board(departure({ time: "10:02:00", rtTime: "10:30:00" }));

      expect(trains[0]).toMatchObject({ delay: 28, status: null });
    });

    it.each([
      ["cancelled flag", { cancelled: true }],
      ["JourneyStatus C", { JourneyStatus: "C" }],
      ["JourneyStatus CANCELLED", { JourneyStatus: "CANCELLED" }],
      ["lowercase JourneyStatus", { JourneyStatus: "cancelled" }],
    ])("treats a train as cancelled via %s", async (_label, overrides) => {
      const { trains } = await board(departure({ rtTime: "10:30:00", ...overrides }));

      expect(trains[0]).toMatchObject({ status: "cancelled", delay: null });
    });

    it("keeps cancelled trains that are in the past", async () => {
      const { trains } = await board(departure({ time: "08:00:00", cancelled: true }));

      expect(trains).toHaveLength(1);
      expect(trains[0]?.status).toBe("cancelled");
    });

    it("does not treat partial cancellation as full cancellation", async () => {
      const { trains } = await board(departure({ partCancelled: true }));

      expect(trains[0]?.status).toBeNull();
    });
  });

  describe("info", () => {
    const note = (overrides: Record<string, unknown>) => ({ Note: [overrides] });

    it("includes remark notes and cancellation notes only", async () => {
      const { trains } = await board(
        departure({
          Notes: {
            Note: [
              { type: "R", txtN: "Replacement bus" },
              { key: "Cancellation", type: "X", txtL: "Train cancelled today" },
              { type: "A", txtN: "Bicycles allowed" },
              { type: "R", txtN: "   " },
            ],
          },
        }),
      );

      expect(trains[0]?.info).toBe("Replacement bus · Train cancelled today");
    });

    it("accepts a single note object and falls back across text fields", async () => {
      const { trains } = await board(
        departure({ Notes: { Note: { type: "R", value: "From value" } } }),
        departure({
          ProductAtStop: { displayNumber: "2" },
          Notes: note({ type: "R", txtS: "Short" }),
        }),
        departure({
          ProductAtStop: { displayNumber: "3" },
          Notes: note({ type: "R", txtN: "Normal", txtL: "Long", value: "Value", txtS: "Short" }),
        }),
        departure({
          ProductAtStop: { displayNumber: "4" },
          Notes: note({ type: "R", txtL: "Long", value: "Value" }),
        }),
      );

      expect(trains.map((train) => train.info)).toEqual(["From value", "Short", "Normal", "Long"]);
    });

    it("de-duplicates notes and keeps at most three", async () => {
      const { trains } = await board(
        departure({
          Notes: {
            Note: [
              { type: "R", txtN: "One" },
              { type: "R", txtN: "One" },
              { type: "R", txtN: "Two" },
              { type: "R", txtN: "Three" },
              { type: "R", txtN: "Four" },
            ],
          },
        }),
      );

      expect(trains[0]?.info).toBe("One · Two · Three");
    });

    it("labels additional services", async () => {
      const { trains } = await board(
        departure({ JourneyStatus: "A", Notes: note({ type: "R", txtN: "Extra coaches" }) }),
        departure({ ProductAtStop: { displayNumber: "2" }, JourneyStatus: "A" }),
      );

      expect(trains.map((train) => train.info)).toEqual([
        "Additional service · Extra coaches",
        "Additional service",
      ]);
    });
  });

  describe("duplicates", () => {
    it("merges duplicates of the same train, time and destination", async () => {
      const { trains } = await board(
        departure({
          ProductAtStop: { displayNumber: "3412", catOut: "RE" },
          track: "7",
        }),
        departure({
          ProductAtStop: { displayNumber: "3412", operatorCode: "CFL" },
          track: undefined,
          rtTime: "10:22:00",
          Notes: { Note: [{ type: "R", txtN: "Delay" }] },
        }),
      );

      // The realtime row wins; missing fields come from the other row.
      expect(trains).toEqual([
        {
          brand: "CFL",
          category: "RE",
          trainNumber: "3412",
          destination: "Luxembourg",
          scheduledTime: "10:20",
          delay: 2,
          platform: "7",
          status: null,
          info: "Delay",
        },
      ]);
    });

    it("keeps the first row on equal quality and fills missing fields from the second", async () => {
      const { trains } = await board(
        departure({
          ProductAtStop: { displayNumber: "3412", catOut: "RE" },
          track: undefined,
          Notes: { Note: [{ type: "R", txtN: "A" }] },
        }),
        departure({
          ProductAtStop: { displayNumber: "3412", catOut: "IC", operatorCode: "CFL" },
          track: "2",
          Notes: { Note: [{ type: "R", txtN: "B" }] },
        }),
      );

      expect(trains).toEqual([
        expect.objectContaining({
          brand: "CFL",
          category: "RE",
          platform: "2",
          info: "A · B",
        }),
      ]);
    });

    it("lets a cancelled row beat a live row", async () => {
      const { trains } = await board(
        departure({ rtTime: "10:25:00" }),
        departure({ cancelled: true }),
      );

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ status: "cancelled", delay: null });
    });

    it("prefers a row with realtime or additional status over a plain one", async () => {
      const { trains } = await board(
        departure({}),
        departure({ JourneyStatus: "A", Notes: { Note: [{ type: "R", txtN: "Added" }] } }),
      );

      expect(trains).toHaveLength(1);
      expect(trains[0]?.info).toBe("Additional service · Added");
    });

    it("does not merge trains with different destinations or times", async () => {
      const { trains } = await board(
        departure({ direction: "Luxembourg" }),
        departure({ direction: "Troisvierges" }),
        departure({ time: "10:40:00" }),
      );

      expect(trains).toHaveLength(3);
    });

    it("orders equal times by quality, best first", async () => {
      const { trains } = await board(
        departure({ ProductAtStop: { displayNumber: "plain" } }),
        departure({ ProductAtStop: { displayNumber: "live" }, rtTime: "10:20:00" }),
        departure({ ProductAtStop: { displayNumber: "cancelled" }, cancelled: true }),
      );

      expect(trains.map((train) => train.trainNumber)).toEqual(["cancelled", "live", "plain"]);
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("cdt.hafas.de", textResponse("denied", { status: 401 }));

      const error = await scrapeLuxembourgTrains("LU00001", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("Luxembourg"),
        upstream: { host: "cdt.hafas.de", status: 401 },
      });
    });

    it("maps network failures to 502", async () => {
      fetchMock.fail();

      await expect(scrapeLuxembourgTrains("LU00001", "departures", ENV)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("Luxembourg"),
      });
    });

    it("rejects invalid JSON with 502", async () => {
      fetchMock.on("cdt.hafas.de", textResponse("<html>oops</html>"));

      await expect(scrapeLuxembourgTrains("LU00001", "departures", ENV)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("invalid response"),
      });
    });

    it("rejects a board with an errorCode", async () => {
      fetchMock.on(
        "cdt.hafas.de",
        jsonResponse({ errorCode: "SVC_LOC", errorText: "location missing" }),
      );

      const error = await scrapeLuxembourgTrains("LU00001", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 502,
        message: "The Luxembourg transport data source returned an invalid response.",
        timing: { fetchMs: expect.any(Number) },
      });
    });

    it("rejects a Departure field that is not an array", async () => {
      fetchMock.on("cdt.hafas.de", jsonResponse({ Departure: { name: "single" } }));

      await expect(scrapeLuxembourgTrains("LU00001", "departures", ENV)).rejects.toMatchObject({
        statusCode: 502,
      });
    });
  });
});
