import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeSwedenTrains } from "../../src/scrapers/sweden";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Stockholm (CET)
const ENV = { TRAFIKLAB_KEY: "test-key" };

type Place = { id: string; name: string } | null;

type Entry = {
  scheduled: string;
  realtime: string | null;
  delay: number;
  canceled: boolean;
  is_realtime: boolean;
  route: {
    name: string | null;
    designation: string | null;
    transport_mode_code: number;
    transport_mode: string;
    direction: string | null;
    origin: Place;
    destination: Place;
  };
  trip: { trip_id: string; technical_number: number };
  agency: { id: string; name: string; operator: string };
  stop: { id: string; name: string; lat: number; lon: number };
  scheduled_platform: { id: string; designation: string } | null;
  realtime_platform: { id: string; designation: string } | null;
  alerts: { type: string; title: string; text: string }[];
};

type EntryOverrides = Partial<Omit<Entry, "route" | "agency" | "stop">> & {
  route?: Partial<Entry["route"]>;
  agency?: Partial<Entry["agency"]>;
  stop?: Partial<Entry["stop"]>;
};

function entry({ route, agency, stop, ...rest }: EntryOverrides = {}): Entry {
  return {
    scheduled: "2026-03-10T10:30:00",
    realtime: "2026-03-10T10:30:00",
    delay: 0,
    canceled: false,
    is_realtime: true,
    trip: { trip_id: "trip-1", technical_number: 521 },
    scheduled_platform: { id: "p1", designation: "4" },
    realtime_platform: null,
    alerts: [],
    ...rest,
    route: {
      name: "Stockholm C - Göteborg C",
      designation: "521",
      transport_mode_code: 102,
      transport_mode: "TRAIN",
      direction: "Göteborg C",
      origin: { id: "740098001", name: "Stockholm Central" },
      destination: { id: "740000002", name: "Göteborg Central" },
      ...route,
    },
    agency: { id: "a1", name: "SJ", operator: "SJ AB", ...agency },
    stop: { id: "740098001", name: "Stockholm Central", lat: 59.33, lon: 18.06, ...stop },
  };
}

describe("scrapeSwedenTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const board = (entries: Entry[], key: "departures" | "arrivals" = "departures") =>
    jsonResponse({ timestamp: "2026-03-10T10:00:00", [key]: entries });

  describe("request", () => {
    it("requests the Trafiklab departures endpoint with the converted area id and key", async () => {
      fetchMock.on("realtime-api.trafiklab.se", board([]));

      await scrapeSwedenTrains("SE098001", "departures", ENV);

      const url = fetchMock.url();
      expect(url.origin + url.pathname).toBe(
        "https://realtime-api.trafiklab.se/v1/departures/740098001",
      );
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(fetchMock.requests[0]?.headers.get("accept")).toBe("application/json");
    });

    it("defaults to departures and uses the arrivals endpoint when asked", async () => {
      fetchMock.on("realtime-api.trafiklab.se", board([]));

      await scrapeSwedenTrains("SE098001", undefined, ENV);
      await scrapeSwedenTrains("SE098001", "arrivals", ENV);

      expect(fetchMock.url(0).pathname).toBe("/v1/departures/740098001");
      expect(fetchMock.url(1).pathname).toBe("/v1/arrivals/740098001");
    });

    it("throws a 500 ScraperError without any request when the API key is missing", async () => {
      const missingEnv = await scrapeSwedenTrains("SE098001").catch((error: unknown) => error);
      const emptyKey = await scrapeSwedenTrains("SE098001", "departures", {
        TRAFIKLAB_KEY: "",
      }).catch((error: unknown) => error);

      for (const error of [missingEnv, emptyKey]) {
        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 500,
          message: expect.stringContaining("Swedish"),
        });
      }
      expect(fetchMock.requests).toHaveLength(0);
    });

    it("throws a 404 ScraperError for a station id without a numeric part", async () => {
      const error = await scrapeSwedenTrains("SE", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404, message: "Unknown Swedish station." });
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({
            realtime: "2026-03-10T10:34:00",
            delay: 240,
            realtime_platform: { id: "p2", designation: "7" },
            alerts: [{ type: "DELAY", title: "Signalfel", text: "Signalfel vid Flemingsberg" }],
          }),
        ]),
      );

      const result = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "SJ",
          category: "IC",
          trainNumber: "521",
          destination: "Göteborg Central",
          scheduledTime: "10:30",
          delay: 4,
          platform: "7",
          status: null,
          info: "Signalfel",
        },
      ]);
    });

    it("uses the origin for arrivals", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board(
          [
            entry({
              route: {
                origin: { id: "o", name: "Malmö Central" },
                destination: { id: "d", name: "Stockholm Central" },
              },
              stop: { name: "Stockholm Central" },
            }),
          ],
          "arrivals",
        ),
      );

      const [train] = (await scrapeSwedenTrains("SE098001", "arrivals", ENV)).trains;

      expect(train?.origin).toBe("Malmö Central");
      expect(train).not.toHaveProperty("destination");
    });

    it("leaves the arrival origin undefined when the route has none", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([entry({ route: { origin: null } })], "arrivals"),
      );

      const [train] = (await scrapeSwedenTrains("SE098001", "arrivals", ENV)).trains;

      expect(train?.origin).toBeUndefined();
    });

    it.each([
      [101, "HS"],
      [102, "IC"],
      [103, "IR"],
      [104, "IC"],
      [105, "SLP"],
      [106, "RE"],
      [107, "RE"],
      [109, "S"],
      [100, "RE"],
      [999, null],
    ])("maps GTFS route type %i to category %s", async (code, category) => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([entry({ route: { transport_mode_code: code } })]),
      );

      const [train] = (await scrapeSwedenTrains("SE098001", "departures", ENV)).trains;

      expect(train?.category).toBe(category);
    });

    it.each([
      [{ operator: "Pågatågen", name: "Pågatågen" }, "Skånetrafiken"],
      [{ operator: "SJ AB", name: "SJ" }, "SJ"],
      [{ operator: "SJ Götalandståg", name: "SJ" }, "SJ"],
      [{ operator: "VR Sverige AB", name: "VR" }, "VR"],
      [{ operator: "VR Sverige", name: "VR" }, "VR"],
      [{ operator: "VyGruppen AS", name: "Vy" }, "Vy"],
      [{ operator: "MTR Express AB", name: "MTR" }, "VR Snabbtåg"],
      [{ operator: "MTRX", name: "MTR" }, "VR Snabbtåg"],
      [{ operator: "VR Snabbtåg AB", name: "VR" }, "VR Snabbtåg"],
      [{ operator: "Snälltåget AB", name: "Snälltåget" }, "Snälltåget"],
      [{ operator: "Transdev Sverige AB", name: "Transdev" }, "Transdev"],
      [{ operator: "Transdev Mälartåg", name: "Mälartåg" }, "Transdev"],
      [{ operator: "Svenska Tågkompaniet AB", name: "Tåg" }, "Transdev"],
      [{ operator: "TÅGAB", name: "Tåg" }, "Transdev"],
      [{ operator: "Värmlandstrafik AB", name: "Värmlandstrafik" }, "Transdev"],
      [{ operator: "Öresundståg AB", name: "Öresundståg" }, "Öresundståg AB"],
      [{ operator: "  ", name: "Fallback Agency" }, "Fallback Agency"],
      [{ operator: "", name: "" }, null],
    ])("derives the brand from agency %j", async (agency, brand) => {
      fetchMock.on("realtime-api.trafiklab.se", board([entry({ agency })]));

      const [train] = (await scrapeSwedenTrains("SE098001", "departures", ENV)).trains;

      expect(train?.brand).toBe(brand);
    });

    it("uses the technical number when the route has no designation", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({ route: { designation: null }, trip: { trip_id: "t", technical_number: 8123 } }),
        ]),
      );

      const [train] = (await scrapeSwedenTrains("SE098001", "departures", ENV)).trains;

      expect(train?.trainNumber).toBe("8123");
    });

    it("prefers the realtime platform, then the scheduled one, then null", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({
            trip: { trip_id: "a", technical_number: 1 },
            realtime_platform: { id: "r", designation: "9" },
            scheduled_platform: { id: "s", designation: "4" },
          }),
          entry({ trip: { trip_id: "b", technical_number: 2 }, route: { designation: "2" } }),
          entry({
            trip: { trip_id: "c", technical_number: 3 },
            route: { designation: "3" },
            scheduled_platform: null,
          }),
        ]),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains.map((train) => train.platform)).toEqual(["9", "4", null]);
    });

    it("rounds the delay from seconds to minutes and drops non-positive delays", async () => {
      const delays = [0, 29, 30, 90, 180, -120];
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board(delays.map((delay, index) => entry({ delay, route: { designation: `T${index}` } }))),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains.map((train) => train.delay)).toEqual([null, null, 1, 2, 3, null]);
    });

    it("shows the scheduled wall-clock time, or a placeholder when it is unparseable", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({ scheduled: "2026-03-10T23:58:00", realtime: null }),
          entry({ scheduled: "", realtime: null, route: { designation: "x" } }),
        ]),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["23:58", "--:--"]);
    });

    it("takes the first alert title as info", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({
            alerts: [
              { type: "A", title: "First", text: "one" },
              { type: "B", title: "Second", text: "two" },
            ],
          }),
        ]),
      );

      const [train] = (await scrapeSwedenTrains("SE098001", "departures", ENV)).trains;

      expect(train?.info).toBe("First");
    });
  });

  describe("destination", () => {
    const destinationFor = async (route: Partial<Entry["route"]>) => {
      fetchMock.once("realtime-api.trafiklab.se", board([entry({ route })]));
      const [train] = (await scrapeSwedenTrains("SE098001", "departures", ENV)).trains;
      return train?.destination;
    };

    it("falls back to the route direction when there is no destination", async () => {
      expect(await destinationFor({ destination: null, direction: "Uppsala" })).toBe("Uppsala");
    });

    it("is undefined when neither destination nor direction exist", async () => {
      expect(await destinationFor({ destination: null, direction: null })).toBeUndefined();
    });

    it("uses direction, then route name, for circular routes", async () => {
      const place = { id: "x", name: "Pendel" };
      expect(
        await destinationFor({
          origin: place,
          destination: place,
          direction: "Varvet",
          name: "Ringen",
        }),
      ).toBe("Varvet");
      expect(
        await destinationFor({
          origin: place,
          destination: place,
          direction: null,
          name: "Ringen",
        }),
      ).toBe("Ringen");
      expect(
        await destinationFor({ origin: place, destination: place, direction: null, name: null }),
      ).toBe("Pendel");
    });
  });

  describe("status", () => {
    const statusFor = async (
      overrides: EntryOverrides,
      type: "departures" | "arrivals" = "departures",
    ) => {
      fetchMock.once("realtime-api.trafiklab.se", board([entry(overrides)], type));
      const [train] = (await scrapeSwedenTrains("SE098001", type, ENV)).trains;
      return train?.status;
    };

    it("marks cancelled trains regardless of times", async () => {
      expect(await statusFor({ canceled: true })).toBe("cancelled");
    });

    it("cancellation wins over a near realtime", async () => {
      expect(await statusFor({ canceled: true, realtime: "2026-03-10T10:01:00" })).toBe(
        "cancelled",
      );
    });

    it("marks departures within five minutes of now as departing, inclusive of the edges", async () => {
      expect(await statusFor({ realtime: "2026-03-10T10:05:00" })).toBe("departing");
    });

    it("marks arrivals within the window as incoming (past edge)", async () => {
      expect(await statusFor({ realtime: "2026-03-10T09:55:00" }, "arrivals")).toBe("incoming");
    });

    it("has no status just outside the window", async () => {
      expect(await statusFor({ realtime: "2026-03-10T10:05:01" })).toBeNull();
      expect(await statusFor({ realtime: "2026-03-10T09:54:59" })).toBeNull();
    });

    it("uses the realtime estimate over the scheduled time", async () => {
      // Scheduled long ago but expected in two minutes.
      expect(
        await statusFor({ scheduled: "2026-03-10T09:30:00", realtime: "2026-03-10T10:02:00" }),
      ).toBe("departing");
    });

    it("falls back to the scheduled time when there is no realtime", async () => {
      expect(await statusFor({ realtime: null, scheduled: "2026-03-10T10:03:00" })).toBe(
        "departing",
      );
    });

    it("interprets local times in summer time (CEST)", async () => {
      freezeTime("2026-07-01T08:00:00.000Z"); // 10:00 CEST
      expect(
        await statusFor({ scheduled: "2026-07-01T10:02:00", realtime: "2026-07-01T10:02:00" }),
      ).toBe("departing");
      // 11:02 local would be inside the window only if the offset were wrongly applied twice.
      expect(
        await statusFor({ scheduled: "2026-07-01T09:02:00", realtime: "2026-07-01T09:02:00" }),
      ).toBeNull();
    });

    it("ignores times that carry an explicit offset", async () => {
      expect(
        await statusFor({ scheduled: "2026-03-10T10:02:00+01:00", realtime: null }),
      ).toBeNull();
    });
  });

  describe("filtering", () => {
    it("keeps rail only", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({ route: { transport_mode: "BUS", designation: "bus" } }),
          entry({ route: { transport_mode: "FERRY", designation: "ferry" } }),
          entry({ route: { designation: "train" } }),
        ]),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["train"]);
    });

    it("hides departures that terminate at the station but keeps such arrivals", async () => {
      const terminating = entry({
        route: { destination: { id: "d", name: "Stockholm Central" } },
        stop: { name: "Stockholm Central" },
      });
      fetchMock.on("realtime-api.trafiklab.se", (request) =>
        request.url.includes("/departures/")
          ? board([terminating])
          : board([terminating], "arrivals"),
      );

      const departures = await scrapeSwedenTrains("SE098001", "departures", ENV);
      const arrivals = await scrapeSwedenTrains("SE098001", "arrivals", ENV);

      expect(departures.trains).toEqual([]);
      expect(arrivals.trains).toHaveLength(1);
    });

    it("deduplicates by train number and scheduled time, keeping upstream order", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board([
          entry({ route: { designation: "B" }, scheduled: "2026-03-10T10:40:00" }),
          entry({ route: { designation: "A" }, scheduled: "2026-03-10T10:10:00" }),
          entry({ route: { designation: "B" }, scheduled: "2026-03-10T10:40:00", delay: 600 }),
          entry({ route: { designation: "B" }, scheduled: "2026-03-10T11:40:00" }),
        ]),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains.map((train) => [train.trainNumber, train.scheduledTime])).toEqual([
        ["B", "10:40"],
        ["A", "10:10"],
        ["B", "11:40"],
      ]);
      expect(trains[0]?.delay).toBeNull();
    });

    it("keeps at most 16 trains", async () => {
      fetchMock.on(
        "realtime-api.trafiklab.se",
        board(
          Array.from({ length: 20 }, (_, index) =>
            entry({ route: { designation: String(index) } }),
          ),
        ),
      );

      const { trains } = await scrapeSwedenTrains("SE098001", "departures", ENV);

      expect(trains).toHaveLength(16);
      expect(trains[0]?.trainNumber).toBe("0");
      expect(trains[15]?.trainNumber).toBe("15");
    });
  });

  describe("edge cases and errors", () => {
    it("returns an empty board when the response lacks the requested list", async () => {
      fetchMock.on("realtime-api.trafiklab.se", jsonResponse({ timestamp: "2026-03-10T10:00:00" }));

      await expect(scrapeSwedenTrains("SE098001", "arrivals", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("realtime-api.trafiklab.se", jsonResponse({ message: "busy" }, { status: 503 }));

      const error = await scrapeSwedenTrains("SE098001", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("Swedish"),
        upstream: { host: "realtime-api.trafiklab.se", status: 503 },
      });
    });

    it("reports an invalid JSON body as a 502", async () => {
      fetchMock.on("realtime-api.trafiklab.se", textResponse("<html>oops</html>"));

      const error = await scrapeSwedenTrains("SE098001", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Swedish") });
    });
  });
});
