import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freezeTime, jsonResponse, mockFetch, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Warsaw (CET)
const ENV = { PLK_API_KEY: "key" };
const OPERATIONS = "pdp-api.plk-sa.pl/api/v1/operations";
const SCHEDULES = "pdp-api.plk-sa.pl/api/v1/schedules";

const STATION = 1234;
const STATION_ID = `PL${STATION}`;

type Stop = Record<string, unknown>;
type Operation = Record<string, unknown>;
type Route = Record<string, unknown>;

/** Time `minutes` from the frozen now, as the ISO strings PLK sends. */
function at(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function opStop(stationId: number, sequence: number, overrides: Stop = {}): Stop {
  return {
    stationId,
    plannedSequenceNumber: sequence,
    actualSequenceNumber: sequence,
    isConfirmed: true,
    isCancelled: false,
    ...overrides,
  };
}

/** An operation calling at the test station (sequence 2) between stations 1000 and 3000. */
function operation(overrides: Operation = {}, stopOverrides: Stop = {}): Operation {
  return {
    scheduleId: 1,
    orderId: 1,
    trainOrderId: 555,
    operatingDate: "2026-03-10",
    trainStatus: "Normal",
    stations: [
      opStop(1000, 1, { plannedDeparture: at(-30) }),
      opStop(STATION, 2, {
        plannedArrival: at(10),
        plannedDeparture: at(12),
        ...stopOverrides,
      }),
      opStop(3000, 3, { plannedArrival: at(60) }),
    ],
    ...overrides,
  };
}

function route(overrides: Route = {}): Route {
  return {
    scheduleId: 1,
    orderId: 1,
    name: "KRAKUS",
    carrierCode: "IC",
    nationalNumber: "5501",
    commercialCategorySymbol: "EIP",
    stations: [
      { stationId: 1000, orderNumber: 1, departureTrainNumber: "5501" },
      {
        stationId: STATION,
        orderNumber: 2,
        arrivalTrainNumber: "5501",
        arrivalPlatform: "2",
        arrivalCommercialCategory: "EIC",
        departureTrainNumber: "5502",
        departurePlatform: "3",
        departureCommercialCategory: "EIP",
      },
      { stationId: 3000, orderNumber: 3, arrivalTrainNumber: "5502" },
    ],
    ...overrides,
  };
}

const STATION_NAMES = {
  "1000": "Kraków Główny",
  [String(STATION)]: "Test Station",
  "3000": "Gdynia Główna",
};

function operationsBody(
  trains: Operation[] | null | undefined,
  stations: Record<string, string> | null = STATION_NAMES,
) {
  return { generatedAt: "2026-03-10T09:00:00Z", trains, stations };
}

function schedulesBody(routes: Route[] | null | undefined = [route()]) {
  return { routes };
}

describe("scrapePolandTrains", () => {
  let fetchMock: FetchMock;
  let scrape: typeof import("../../src/scrapers/poland").scrapePolandTrains;
  let ScraperError: typeof import("../../src/scrapers/core").ScraperError;

  /** Serve one operations board and one schedule set for every station. */
  function serve(trains: Operation[] | null | undefined, routes?: Route[] | null) {
    fetchMock.on(OPERATIONS, jsonResponse(operationsBody(trains)));
    fetchMock.on(
      SCHEDULES,
      jsonResponse(schedulesBody(routes === null ? null : (routes ?? [route()]))),
    );
  }

  const operationRequests = () =>
    fetchMock.requests.filter((request) => request.url.includes("/operations"));
  const scheduleRequests = () =>
    fetchMock.requests.filter((request) => request.url.includes("/schedules"));

  beforeEach(async () => {
    freezeTime(NOW);
    fetchMock = mockFetch();
    // The scraper keeps module-level caches; load a fresh copy for every test.
    vi.resetModules();
    ({ scrapePolandTrains: scrape } = await import("../../src/scrapers/poland"));
    ({ ScraperError } = await import("../../src/scrapers/core"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("fetches operations and schedules for the station with the API key", async () => {
      serve([]);

      await scrape(STATION_ID, "departures", ENV);

      expect(fetchMock.requests).toHaveLength(2);
      const operations = new URL(operationRequests()[0]!.url);
      expect(operations.origin + operations.pathname).toBe(
        "https://pdp-api.plk-sa.pl/api/v1/operations",
      );
      expect(Object.fromEntries(operations.searchParams)).toEqual({
        stations: "1234",
        fullRoutes: "true",
        withPlanned: "true",
        pageSize: "24",
      });
      const schedules = new URL(scheduleRequests()[0]!.url);
      expect(schedules.pathname).toBe("/api/v1/schedules");
      expect(Object.fromEntries(schedules.searchParams)).toEqual({
        stations: "1234",
        fullRoute: "true",
        dictionaries: "true",
      });
      for (const { headers } of fetchMock.requests) {
        expect(headers.get("x-api-key")).toBe("key");
        expect(headers.get("accept")).toBe("application/json");
        expect(headers.get("user-agent")).toBe("RailRadar/1.0 (+https://railradar24.com)");
      }
    });

    it("uses the same upstream requests for arrivals and departures", async () => {
      serve([]);

      await scrape(STATION_ID, "arrivals", ENV);

      expect(new URL(operationRequests()[0]!.url).searchParams.get("stations")).toBe("1234");
    });

    it.each(["XX1234", "PL", "PL12A", "pl1234", "1234"])(
      "rejects the unknown station %j with a 404",
      async (id) => {
        const error = await scrape(id, "departures", ENV).catch((error: unknown) => error);

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({ statusCode: 404, message: "Unknown Polish station." });
        expect(fetchMock.requests).toHaveLength(0);
      },
    );

    it.each([undefined, {}, { PLK_API_KEY: "" }])(
      "fails with a 500 when the API key is missing (%j)",
      async (env) => {
        const error = await scrape(STATION_ID, "departures", env).catch((error: unknown) => error);

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 500,
          message: "Polish train data source is not configured.",
        });
        expect(fetchMock.requests).toHaveLength(0);
      },
    );
  });

  describe("response mapping", () => {
    it("maps a departure using schedule data", async () => {
      serve([
        operation(
          {},
          {
            plannedDeparture: "2026-03-10T09:20:00Z",
            departureDelayMinutes: 3,
            actualDeparture: "2026-03-10T09:23:00Z",
          },
        ),
      ]);

      const result = await scrape(STATION_ID, "departures", ENV);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "PKP Intercity",
          category: "EIP",
          trainNumber: "5502",
          destination: "Gdynia Główna",
          scheduledTime: "10:20",
          delay: 3,
          platform: "3",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival with its origin and arrival-side schedule data", async () => {
      serve([
        operation(
          {},
          {
            plannedArrival: "2026-03-10T09:03:00Z",
            arrivalDelayMinutes: 2,
            actualArrival: "2026-03-10T09:05:00Z",
          },
        ),
      ]);

      const result = await scrape(STATION_ID, "arrivals", ENV);

      expect(result.trains).toEqual([
        {
          brand: "PKP Intercity",
          category: "EIC",
          trainNumber: "5501",
          origin: "Kraków Główny",
          scheduledTime: "10:03",
          delay: 2,
          platform: "2",
          status: "incoming",
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("falls back from stop data to route data to the operation id", async () => {
      serve(
        [
          operation(),
          operation({ scheduleId: 2, trainOrderId: 777 }),
          operation({ scheduleId: 3, trainOrderId: 888 }),
        ],
        [
          route({
            commercialCategorySymbol: "TLK",
            stations: [
              { stationId: STATION, orderNumber: 2 },
              { stationId: 3000, orderNumber: 3 },
            ],
          }),
          route({
            scheduleId: 3,
            nationalNumber: null,
            commercialCategorySymbol: null,
            stations: [{ stationId: STATION, orderNumber: 2 }],
          }),
        ],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => [train.trainNumber, train.category, train.platform])).toEqual([
        ["5501", "TLK", null],
        ["777", null, null],
        ["888", null, null],
      ]);
    });

    it("maps known carrier codes and leaves unknown ones without a brand", async () => {
      serve(
        [
          operation({ scheduleId: 1 }),
          operation({ scheduleId: 2 }),
          operation({ scheduleId: 3 }),
          operation({ scheduleId: 4 }),
        ],
        [
          route({ scheduleId: 1, carrierCode: "PR" }),
          route({ scheduleId: 2, carrierCode: "SKMT" }),
          route({ scheduleId: 3, carrierCode: "ZZZ" }),
          route({ scheduleId: 4, carrierCode: null }),
        ],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.brand)).toEqual(["POLREGIO", "SKM", null, null]);
    });

    it("derives the endpoint from operation stops when the schedule has no route", async () => {
      serve([operation()], []);

      const { trains } = await scrape(STATION_ID, "departures", ENV);
      const arrivals = await scrape(STATION_ID, "arrivals", ENV);

      expect(trains[0]).toMatchObject({
        brand: null,
        category: null,
        trainNumber: "555",
        destination: "Gdynia Główna",
        platform: null,
      });
      expect(arrivals.trains[0]?.origin).toBe("Kraków Główny");
    });

    it("omits the endpoint when the train terminates or starts at the station", async () => {
      serve(
        [operation({ scheduleId: 1 })],
        [
          route({
            scheduleId: 1,
            stations: [
              { stationId: 1000, orderNumber: 1 },
              { stationId: STATION, orderNumber: 2, departurePlatform: "1" },
            ],
          }),
        ],
      );

      const departures = await scrape(STATION_ID, "departures", ENV);
      const arrivals = await scrape(STATION_ID, "arrivals", ENV);

      expect(departures.trains[0]).not.toHaveProperty("destination");
      expect(arrivals.trains[0]?.origin).toBe("Kraków Główny");
    });

    it("omits the endpoint when its station name is unknown", async () => {
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()], null)));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]).not.toHaveProperty("destination");
    });

    it("prefers station names from the schedule dictionary over the operations ones", async () => {
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.on(
        SCHEDULES,
        jsonResponse({
          routes: [route()],
          dictionaries: { stations: { "3000": { id: 3000, name: "Gdynia Główna (dict)" } } },
        }),
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.destination).toBe("Gdynia Główna (dict)");
    });

    it("picks the schedule stop matching the operation sequence when a station repeats", async () => {
      serve(
        [operation({}, { plannedSequenceNumber: 4, actualSequenceNumber: 9 })],
        [
          route({
            stations: [
              {
                stationId: STATION,
                orderNumber: 1,
                departureTrainNumber: "A",
                departurePlatform: "1",
              },
              {
                stationId: STATION,
                orderNumber: 4,
                departureTrainNumber: "B",
                departurePlatform: "4",
              },
              { stationId: 3000, orderNumber: 5 },
            ],
          }),
        ],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]).toMatchObject({ trainNumber: "B", platform: "4" });
    });

    it("uses the actual sequence when the planned one is missing, and the first stop when nothing matches", async () => {
      const stops = [
        { stationId: STATION, orderNumber: 1, departureTrainNumber: "A" },
        { stationId: STATION, orderNumber: 7, departureTrainNumber: "B" },
        { stationId: 3000, orderNumber: 8 },
      ];
      serve(
        [
          operation({ scheduleId: 1 }, { plannedSequenceNumber: null, actualSequenceNumber: 7 }),
          operation({ scheduleId: 2 }, { plannedSequenceNumber: 99 }),
        ],
        [route({ scheduleId: 1, stations: stops }), route({ scheduleId: 2, stations: stops })],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["B", "A"]);
    });

    it("does not fail when the schedule request fails", async () => {
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.on(SCHEDULES, jsonResponse({ message: "gone" }, { status: 404 }));

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({
        brand: null,
        trainNumber: "555",
        destination: "Gdynia Główna",
      });
    });
  });

  describe("times", () => {
    it("formats the scheduled time in Warsaw winter time", async () => {
      serve([operation({}, { plannedDeparture: "2026-03-10T09:20:00Z" })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.scheduledTime).toBe("10:20");
    });

    it("formats the scheduled time in Warsaw summer time", async () => {
      vi.setSystemTime(new Date("2026-07-10T08:00:00Z"));
      serve([operation({}, { plannedDeparture: "2026-07-10T08:20:00Z" })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.scheduledTime).toBe("10:20");
    });

    it("shows midnight as 00:xx on the next local day", async () => {
      serve([operation({}, { plannedDeparture: "2026-03-10T23:30:00Z" })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.scheduledTime).toBe("00:30");
    });

    it("falls back to the actual time when there is no planned time", async () => {
      serve([operation({}, { plannedDeparture: null, actualDeparture: "2026-03-10T09:03:00Z" })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]).toMatchObject({ scheduledTime: "10:03", status: "departing" });
    });

    it("shows --:-- for an unparseable planned time and sorts it last", async () => {
      serve([
        operation({ scheduleId: 1 }, { plannedDeparture: "not a date" }),
        operation({ scheduleId: 2 }, { plannedDeparture: at(30) }),
      ]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["10:30", "--:--"]);
      expect(trains[1]?.status).toBeNull();
    });
  });

  describe("status, delay and info", () => {
    it.each([
      [-6, null],
      [-5, "departing"],
      [0, "departing"],
      [5, "departing"],
      [6, null],
    ])(
      "derives a departure status for an actual time %i minutes from now",
      async (minutes, status) => {
        serve([operation({}, { plannedDeparture: at(minutes), actualDeparture: at(minutes) })]);

        const { trains } = await scrape(STATION_ID, "departures", ENV);

        expect(trains[0]?.status).toBe(status);
      },
    );

    it("uses incoming for arrivals inside the window", async () => {
      serve([operation({}, { plannedArrival: at(4), actualArrival: at(4) })]);

      const { trains } = await scrape(STATION_ID, "arrivals", ENV);

      expect(trains[0]?.status).toBe("incoming");
    });

    it("has no status without an actual time", async () => {
      serve([operation({}, { plannedDeparture: at(2) })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.status).toBeNull();
    });

    it("reports positive delays for the board's event only", async () => {
      serve(
        [
          operation(
            { scheduleId: 1 },
            { departureDelayMinutes: 7, arrivalDelayMinutes: 0, plannedDeparture: at(20) },
          ),
          operation({ scheduleId: 2 }, { departureDelayMinutes: 0, plannedDeparture: at(21) }),
          operation({ scheduleId: 3 }, { departureDelayMinutes: -2, plannedDeparture: at(22) }),
          operation({ scheduleId: 4 }, { departureDelayMinutes: null, plannedDeparture: at(23) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.delay)).toEqual([7, null, null, null]);
    });

    it("marks cancelled stops as cancelled regardless of the time", async () => {
      serve([
        operation({}, { isCancelled: true, plannedDeparture: at(-120), actualDeparture: at(-120) }),
      ]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.status).toBe("cancelled");
    });

    it.each([
      [{ trainStatus: "Cancelled" }, "Cancelled"],
      [{ trainStatus: "PartialCancelled" }, "Partially cancelled"],
      [{ trainStatus: "partial_cancelled" }, "Partially cancelled"],
      [{ trainStatus: " Partial-Cancelled " }, "Partially cancelled"],
      [{ trainStatus: "Delayed" }, null],
      [{ trainStatus: "   " }, null],
      [{ trainStatus: null }, null],
    ])("derives the info text from the train status %j", async (overrides, info) => {
      serve([operation(overrides, { plannedDeparture: at(20) })], []);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.info).toBe(info);
    });

    it("flags unconfirmed stops ahead of the train status", async () => {
      serve([operation({ trainStatus: "Cancelled" }, { isConfirmed: false })]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]?.info).toBe("Awaiting confirmation");
    });
  });

  describe("filtering, sorting and limits", () => {
    it("drops operations that do not call at the station or have no time for the board", async () => {
      serve(
        [
          operation({ scheduleId: 1, stations: [opStop(1000, 1, { plannedDeparture: at(5) })] }),
          operation({ scheduleId: 2, stations: null }),
          operation({ scheduleId: 3 }, { plannedDeparture: null, plannedArrival: at(10) }),
          operation({ scheduleId: 4 }, { plannedDeparture: at(15) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
      expect(trains[0]?.scheduledTime).toBe("10:15");
    });

    it("drops trains that already left more than 10 minutes ago but keeps recent ones", async () => {
      serve(
        [
          operation({ scheduleId: 1 }, { plannedDeparture: at(-30), actualDeparture: at(-11) }),
          operation({ scheduleId: 2 }, { plannedDeparture: at(-30), actualDeparture: at(-9) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
      expect(trains[0]?.scheduledTime).toBe("09:30");
    });

    it("keeps long-past cancelled trains", async () => {
      serve([
        operation({}, { isCancelled: true, plannedDeparture: at(-300), actualDeparture: at(-300) }),
      ]);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("drops completed trains that have no actual time", async () => {
      serve(
        [
          operation({ scheduleId: 1, trainStatus: "Completed" }, { plannedDeparture: at(-5) }),
          operation({ scheduleId: 2, trainStatus: "completed" }, { plannedDeparture: at(-4) }),
          operation({ scheduleId: 3, trainStatus: "Running" }, { plannedDeparture: at(-3) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("sorts by scheduled time", async () => {
      serve(
        [
          operation({ scheduleId: 1, trainOrderId: 1 }, { plannedDeparture: at(40) }),
          operation({ scheduleId: 2, trainOrderId: 2 }, { plannedDeparture: at(10) }),
          operation({ scheduleId: 3, trainOrderId: 3 }, { plannedDeparture: at(25) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "3", "1"]);
    });

    it("deduplicates by schedule, order and operating date", async () => {
      serve(
        [
          operation({ trainOrderId: 1 }, { plannedDeparture: at(10) }),
          operation({ trainOrderId: 2 }, { plannedDeparture: at(11) }),
          operation({ operatingDate: "2026-03-11", trainOrderId: 3 }, { plannedDeparture: at(12) }),
          operation({ orderId: 2, trainOrderId: 4 }, { plannedDeparture: at(13) }),
        ],
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["1", "3", "4"]);
    });

    it("limits the board to 24 trains", async () => {
      serve(
        Array.from({ length: 30 }, (_, index) =>
          operation(
            { scheduleId: index + 1, trainOrderId: index + 1 },
            { plannedDeparture: at(index + 1) },
          ),
        ),
        [],
      );

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(24);
      expect(trains[23]?.trainNumber).toBe("24");
    });

    it.each([null, undefined, []])("returns an empty board when trains is %j", async (trains) => {
      serve(trains as Operation[] | null | undefined);

      await expect(scrape(STATION_ID, "departures", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it("returns an empty board when every operation is filtered out", async () => {
      serve([operation({ trainStatus: "Completed" }, { plannedDeparture: at(-5) })]);

      await expect(scrape(STATION_ID, "departures", ENV)).resolves.toMatchObject({ trains: [] });
    });

    it("tolerates a missing routes list in the schedules", async () => {
      serve([operation()], null);

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]).toMatchObject({ brand: null, trainNumber: "555" });
    });
  });

  describe("retries and errors", () => {
    it("retries a transient operations failure and then succeeds", async () => {
      fetchMock.once(OPERATIONS, jsonResponse({}, { status: 503 }));
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
      expect(operationRequests()).toHaveLength(2);
    });

    it("retries rate limiting twice before giving up with the upstream status", async () => {
      fetchMock.on(OPERATIONS, jsonResponse({}, { status: 429 }));

      const error = await scrape(STATION_ID, "departures", ENV).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 429,
        message: expect.stringContaining("Polish"),
        upstream: { host: "pdp-api.plk-sa.pl", path: "/api/v1/operations", status: 429 },
      });
      expect(operationRequests()).toHaveLength(3);
    });

    it.each([400, 401, 404, 501])("does not retry HTTP %i", async (status) => {
      fetchMock.on(OPERATIONS, jsonResponse({}, { status }));

      const error = await scrape(STATION_ID, "departures", ENV).catch((error: unknown) => error);

      expect(error).toMatchObject({
        statusCode: status,
        message: expect.stringContaining("Polish"),
      });
      expect(operationRequests()).toHaveLength(1);
    });

    it("retries network failures as bad gateways", async () => {
      fetchMock.fail();

      const error = await scrape(STATION_ID, "departures", ENV).catch((error: unknown) => error);

      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Polish") });
      expect(fetchMock.fetch).toHaveBeenCalledTimes(3);
    });

    it("keeps at most two upstream requests in flight", async () => {
      let active = 0;
      let peak = 0;
      const respond = (body: unknown) => async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active--;
        return jsonResponse(body);
      };
      fetchMock.on(OPERATIONS, respond(operationsBody([])));
      fetchMock.on(SCHEDULES, respond(schedulesBody()));

      await Promise.all(["PL1", "PL2", "PL3", "PL4"].map((id) => scrape(id, "departures", ENV)));

      expect(peak).toBe(2);
      expect(fetchMock.requests).toHaveLength(8);
    });
  });

  describe("caching", () => {
    it("serves repeated requests within 15 seconds from the cache, for both board types", async () => {
      serve([operation()]);

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 14_000);
      await scrape(STATION_ID, "arrivals", ENV);

      expect(fetchMock.requests).toHaveLength(2);
    });

    it("keeps stations cached independently", async () => {
      serve([]);

      await scrape("PL1", "departures", ENV);
      await scrape("PL2", "departures", ENV);

      expect(operationRequests()).toHaveLength(2);
      expect(scheduleRequests()).toHaveLength(2);
    });

    it("shares one upstream fetch between concurrent requests", async () => {
      serve([operation()]);

      await Promise.all([
        scrape(STATION_ID, "departures", ENV),
        scrape(STATION_ID, "arrivals", ENV),
        scrape(STATION_ID, "departures", ENV),
      ]);

      expect(fetchMock.requests).toHaveLength(2);
    });

    it("refetches operations after 15 seconds but keeps the cached schedules", async () => {
      serve([operation()]);

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 16_000);
      await scrape(STATION_ID, "departures", ENV);

      expect(operationRequests()).toHaveLength(2);
      expect(scheduleRequests()).toHaveLength(1);
    });

    it("serves fresh operations data after the cache expires", async () => {
      fetchMock.once(
        OPERATIONS,
        jsonResponse(
          operationsBody([operation({ trainOrderId: 1 }, { plannedDeparture: at(30) })]),
        ),
      );
      fetchMock.on(
        OPERATIONS,
        jsonResponse(
          operationsBody([operation({ trainOrderId: 2 }, { plannedDeparture: at(30) })]),
        ),
      );
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody([])));

      const first = await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 16_000);
      const second = await scrape(STATION_ID, "departures", ENV);

      expect([first.trains[0]?.trainNumber, second.trains[0]?.trainNumber]).toEqual(["1", "2"]);
    });

    it("refetches schedules after six hours", async () => {
      serve([operation()]);

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 6 * 60 * 60_000 + 1_000);
      await scrape(STATION_ID, "departures", ENV);

      expect(scheduleRequests()).toHaveLength(2);
    });

    it("serves stale operations when the refresh fails within five minutes", async () => {
      fetchMock.once(
        OPERATIONS,
        jsonResponse(operationsBody([operation({}, { plannedDeparture: at(30) })])),
      );
      fetchMock.on(OPERATIONS, jsonResponse({}, { status: 404 }));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      const first = await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 120_000);
      const second = await scrape(STATION_ID, "departures", ENV);

      expect(second.trains).toEqual(first.trains);
      expect(operationRequests()).toHaveLength(2);
    });

    it("does not retry a failed refresh again until the stale entry expires once more", async () => {
      fetchMock.once(
        OPERATIONS,
        jsonResponse(operationsBody([operation({}, { plannedDeparture: at(30) })])),
      );
      fetchMock.on(OPERATIONS, jsonResponse({}, { status: 404 }));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 120_000);
      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 5_000);
      await scrape(STATION_ID, "departures", ENV);

      expect(operationRequests()).toHaveLength(2);
    });

    it("fails once the stale window of five minutes has passed", async () => {
      fetchMock.once(
        OPERATIONS,
        jsonResponse(operationsBody([operation({}, { plannedDeparture: at(30) })])),
      );
      fetchMock.on(OPERATIONS, jsonResponse({}, { status: 404 }));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 5 * 60_000 + 1_000);
      const error = await scrape(STATION_ID, "departures", ENV).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404 });
    });

    it("does not cache failures when nothing is stale", async () => {
      fetchMock.once(OPERATIONS, jsonResponse({}, { status: 404 }));
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.on(SCHEDULES, jsonResponse(schedulesBody()));

      await expect(scrape(STATION_ID, "departures", ENV)).rejects.toMatchObject({
        statusCode: 404,
      });
      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("keeps using stale schedules when a refresh fails within 24 hours", async () => {
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.once(SCHEDULES, jsonResponse(schedulesBody()));
      fetchMock.on(SCHEDULES, jsonResponse({}, { status: 404 }));

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 7 * 60 * 60_000);
      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(scheduleRequests()).toHaveLength(2);
      expect(trains[0]).toMatchObject({ brand: "PKP Intercity", trainNumber: "5502" });
    });

    it("drops schedule data once a failed refresh is older than 24 hours", async () => {
      fetchMock.on(OPERATIONS, jsonResponse(operationsBody([operation()])));
      fetchMock.once(SCHEDULES, jsonResponse(schedulesBody()));
      fetchMock.on(SCHEDULES, jsonResponse({}, { status: 404 }));

      await scrape(STATION_ID, "departures", ENV);
      vi.setSystemTime(Date.now() + 25 * 60 * 60_000);
      const { trains } = await scrape(STATION_ID, "departures", ENV);

      expect(trains[0]).toMatchObject({ brand: null, trainNumber: "555" });
    });
  });
});
