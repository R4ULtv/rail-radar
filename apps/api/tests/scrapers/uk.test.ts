import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeUKTrains } from "../../src/scrapers/uk";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 09:00 in London (GMT)
const ENV = { LDBWS_API_KEY: "test-key" };
const HOST = "api1.raildata.org.uk";

type Location = { locationName: string; crs: string };

type Service = {
  origin?: Location[];
  destination?: Location[];
  currentOrigins?: Location[];
  currentDestinations?: Location[];
  rsid?: string;
  sta?: string;
  eta?: string;
  std?: string;
  etd?: string;
  platform?: string;
  operator?: string;
  operatorCode?: string;
  isCancelled?: boolean;
  serviceType?: string;
  cancelReason?: string;
  delayReason?: string;
  serviceID?: string;
};

const place = (locationName: string, crs = "XXX"): Location => ({ locationName, crs });

function departure(overrides: Service = {}): Service {
  return {
    origin: [place("London Euston", "EUS")],
    destination: [place("Manchester Piccadilly", "MAN")],
    rsid: "VT123400",
    std: "09:30",
    etd: "On time",
    platform: "11",
    operator: "Avanti West Coast",
    operatorCode: "VT",
    isCancelled: false,
    serviceType: "train",
    serviceID: "1320275EUSTON__",
    ...overrides,
  };
}

function arrival(overrides: Service = {}): Service {
  const { std: _std, etd: _etd, ...rest } = departure({ sta: "09:30", eta: "On time" });
  return { ...rest, ...overrides };
}

describe("scrapeUKTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const board = (trainServices?: Service[], extra: Record<string, unknown> = {}) =>
    jsonResponse({
      generatedAt: "2026-03-10T09:00:00",
      locationName: "London Euston",
      crs: "EUS",
      platformAvailable: true,
      areServicesAvailable: true,
      trainServices,
      ...extra,
    });

  const trainsFor = async (services: Service[], type: "arrivals" | "departures" = "departures") => {
    fetchMock.once(HOST, board(services));
    return (await scrapeUKTrains("GB1444", type, ENV)).trains;
  };

  describe("request", () => {
    it("requests the combined LDBWS board for the CRS code with the API key header", async () => {
      fetchMock.on(HOST, board([]));

      await scrapeUKTrains("GB1444", "departures", ENV);

      const url = fetchMock.url();
      expect(url.origin + url.pathname).toBe(
        "https://api1.raildata.org.uk/1010-live-arrival-and-departure-boards-arr-and-dep1_1/LDBWS/api/20220120/GetArrivalDepartureBoard/EUS",
      );
      expect(url.searchParams.get("numRows")).toBe("30");
      expect(fetchMock.requests[0]?.headers.get("x-apikey")).toBe("test-key");
    });

    it("uses the same endpoint for arrivals and defaults to departures", async () => {
      fetchMock.on(HOST, board([]));

      await scrapeUKTrains("GB2968", "arrivals", ENV);
      await scrapeUKTrains("GB6121", undefined, ENV);

      expect(fetchMock.url(0).pathname).toMatch(/\/GetArrivalDepartureBoard\/MAN$/);
      expect(fetchMock.url(1).pathname).toMatch(/\/GetArrivalDepartureBoard\/KGX$/);
    });

    it("throws a 500 ScraperError without any request when the API key is missing", async () => {
      const noEnv = await scrapeUKTrains("GB1444").catch((error: unknown) => error);
      const emptyKey = await scrapeUKTrains("GB1444", "departures", { LDBWS_API_KEY: "" }).catch(
        (error: unknown) => error,
      );
      const wrongType = await scrapeUKTrains("GB1444", "departures", { LDBWS_API_KEY: 42 }).catch(
        (error: unknown) => error,
      );

      for (const error of [noEnv, emptyKey, wrongType]) {
        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({ statusCode: 500, message: expect.stringContaining("LDBWS") });
      }
      expect(fetchMock.requests).toHaveLength(0);
    });

    it("throws a 404 ScraperError for stations without a CRS mapping", async () => {
      const error = await scrapeUKTrains("GB99999999", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404, message: "Unknown UK station." });
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train", async () => {
      fetchMock.on(
        HOST,
        board([
          departure({
            std: "09:30",
            etd: "09:34",
            delayReason: "This train has been delayed by a signalling problem",
          }),
        ]),
      );

      const result = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "VT",
          category: "IC",
          trainNumber: "123400",
          destination: "Manchester Piccadilly",
          scheduledTime: "09:30",
          delay: 4,
          platform: "11",
          status: null,
          info: "This train has been delayed by a signalling problem",
        },
      ]);
    });

    it("maps an arrival using sta/eta and the origin", async () => {
      fetchMock.on(
        HOST,
        board([arrival({ sta: "09:20", eta: "09:25", origin: [place("Glasgow Central", "GLC")] })]),
      );

      const result = await scrapeUKTrains("GB1444", "arrivals", ENV);

      expect(result.trains).toEqual([
        {
          brand: "VT",
          category: "IC",
          trainNumber: "123400",
          origin: "Glasgow Central",
          scheduledTime: "09:20",
          delay: 5,
          platform: "11",
          status: null,
          info: null,
        },
      ]);
    });

    it("keeps only services with the requested scheduled time", async () => {
      const services = [
        departure({ rsid: "VT1" }),
        arrival({ rsid: "VT2" }),
        { ...departure({ rsid: "VT3" }), sta: "09:10" },
      ];

      const departures = await trainsFor(services, "departures");
      const arrivals = await trainsFor(services, "arrivals");

      expect(departures.map((train) => train.trainNumber)).toEqual(["1", "3"]);
      expect(arrivals.map((train) => train.trainNumber)).toEqual(["2", "3"]);
    });

    it("ignores bus and ferry services", async () => {
      fetchMock.on(
        HOST,
        board([departure({ rsid: "VT7" })], {
          busServices: [departure({ rsid: "BUS1", serviceType: "bus" })],
          ferryServices: [departure({ rsid: "FER1", serviceType: "ferry" })],
        }),
      );

      const { trains } = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["7"]);
    });

    it("preserves upstream order without sorting or deduplicating", async () => {
      const trains = await trainsFor([
        departure({ rsid: "VT9", std: "10:00" }),
        departure({ rsid: "VT8", std: "09:10" }),
        departure({ rsid: "VT9", std: "10:00" }),
      ]);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["10:00", "09:10", "10:00"]);
    });

    it("returns an empty board when there are no train services", async () => {
      fetchMock.on(HOST, board(undefined));

      await expect(scrapeUKTrains("GB1444", "departures", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it("upper-cases the operator code as brand and falls back to UK", async () => {
      const trains = await trainsFor([
        departure({ operatorCode: "xc" }),
        departure({ operatorCode: undefined }),
      ]);

      expect(trains.map((train) => train.brand)).toEqual(["XC", "UK"]);
    });

    it.each([
      ["VT", "IC"],
      ["GR", "IC"],
      ["XC", "IC"],
      ["HT", "IC"],
      ["GC", "IC"],
      ["LD", "IC"],
      ["CS", "SLP"],
      ["CH", "EXP"],
      ["HX", "EXP"],
      ["GX", "EXP"],
      ["ES", "EXP"],
      ["TP", "EXP"],
      ["XR", "EL"],
      ["IL", "EL"],
      ["AW", "RE"],
      ["NT", "RE"],
      ["EM", "RE"],
      ["LM", "RE"],
      ["SR", "RE"],
      ["GW", "RE"],
      ["SW", "RE"],
      ["SE", "S"],
      ["SN", "S"],
      ["TL", "S"],
      ["GN", "S"],
      ["CC", "S"],
      ["LE", "S"],
      ["LO", "S"],
      ["ME", "S"],
      ["ZZ", null],
    ])("maps operator %s to category %s", async (operatorCode, category) => {
      const [train] = await trainsFor([departure({ operatorCode })]);

      expect(train?.category).toBe(category);
    });

    it("has no category without an operator code", async () => {
      const [train] = await trainsFor([departure({ operatorCode: undefined })]);

      expect(train?.category).toBeNull();
    });

    it("derives the train number from rsid, then serviceID, then empty", async () => {
      const trains = await trainsFor([
        departure({ rsid: "GW987654", serviceID: "ignored" }),
        departure({ rsid: "NOTRAILING", serviceID: "5555" }),
        departure({ rsid: undefined, serviceID: "1320275EUSTON__" }),
        departure({ rsid: undefined, serviceID: "EUSTON123" }),
        departure({ rsid: undefined, serviceID: undefined }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual([
        "987654",
        "NOTRAILING",
        "1320275",
        "",
        "",
      ]);
    });

    it("prefers current destinations and joins multiple ones", async () => {
      const trains = await trainsFor([
        departure({
          destination: [place("Original")],
          currentDestinations: [place("Crewe"), place("Liverpool Lime Street")],
        }),
        departure({
          destination: [place("Original"), place("Other")],
          currentDestinations: undefined,
        }),
        departure({ destination: [], currentDestinations: undefined }),
        departure({ destination: undefined, currentDestinations: undefined }),
      ]);

      expect(trains.map((train) => train.destination)).toEqual([
        "Crewe & Liverpool Lime Street",
        "Original & Other",
        "",
        "",
      ]);
    });

    it("prefers current origins for arrivals and falls back to empty", async () => {
      const trains = await trainsFor(
        [
          arrival({ origin: [place("Original")], currentOrigins: [place("Rugby")] }),
          arrival({ origin: [place("Birmingham"), place("Wolverhampton")] }),
          arrival({ origin: undefined, currentOrigins: undefined }),
        ],
        "arrivals",
      );

      expect(trains.map((train) => train.origin)).toEqual([
        "Rugby",
        "Birmingham & Wolverhampton",
        "",
      ]);
    });

    it("leaves the platform null when none is published", async () => {
      const [train] = await trainsFor([departure({ platform: undefined })]);

      expect(train?.platform).toBeNull();
    });

    it("combines cancel and delay reasons into info", async () => {
      const trains = await trainsFor([
        departure({ cancelReason: "Broken down train", delayReason: "Earlier fault" }),
        departure({ cancelReason: "Broken down train" }),
        departure({ delayReason: "Earlier fault" }),
        departure(),
      ]);

      expect(trains.map((train) => train.info)).toEqual([
        "Broken down train. Earlier fault",
        "Broken down train",
        "Earlier fault",
        null,
      ]);
    });
  });

  describe("delay", () => {
    it.each([
      ["09:30", "09:37", 7],
      ["09:30", "09:30", 0],
      ["09:30", "09:25", 0],
      ["09:30", "On time", null],
      ["09:30", "Delayed", null],
      ["09:30", "Cancelled", null],
      ["23:55", "00:05", 10],
      ["00:05", "23:55", 0],
    ])("scheduled %s with estimate %s gives delay %s", async (std, etd, delay) => {
      const [train] = await trainsFor([departure({ std, etd })]);

      expect(train?.delay).toBe(delay);
    });

    it("has no delay when the estimate is missing", async () => {
      const [train] = await trainsFor([departure({ etd: undefined })]);

      expect(train?.delay).toBeNull();
    });

    it("has no delay when the scheduled time is malformed", async () => {
      const [train] = await trainsFor([departure({ std: "9:30", etd: "09:40" })]);

      expect(train?.delay).toBeNull();
    });
  });

  describe("status", () => {
    const statusFor = async (service: Service, type: "arrivals" | "departures" = "departures") =>
      (await trainsFor([service], type))[0]?.status;

    it("marks services flagged as cancelled", async () => {
      expect(await statusFor(departure({ isCancelled: true, std: "09:01" }))).toBe("cancelled");
    });

    it("marks services whose estimate is Cancelled", async () => {
      expect(await statusFor(departure({ etd: "Cancelled" }))).toBe("cancelled");
      expect(await statusFor(arrival({ eta: "Cancelled" }), "arrivals")).toBe("cancelled");
    });

    it("marks departures within five minutes as departing, edges inclusive", async () => {
      expect(await statusFor(departure({ std: "09:05", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "08:55", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "09:06", etd: "On time" }))).toBeNull();
      expect(await statusFor(departure({ std: "08:54", etd: "On time" }))).toBeNull();
    });

    it("marks arrivals within five minutes as incoming", async () => {
      expect(await statusFor(arrival({ sta: "09:03", eta: "On time" }), "arrivals")).toBe(
        "incoming",
      );
      expect(await statusFor(arrival({ sta: "09:40", eta: "On time" }), "arrivals")).toBeNull();
    });

    it("uses the estimate rather than the schedule when it is a time", async () => {
      // Scheduled twenty minutes ago but now expected in three.
      expect(await statusFor(departure({ std: "08:40", etd: "09:03" }))).toBe("departing");
      // Scheduled in two minutes but delayed by thirty.
      expect(await statusFor(departure({ std: "09:02", etd: "09:32" }))).toBeNull();
    });

    it("falls back to the schedule when the estimate is not a time", async () => {
      expect(await statusFor(departure({ std: "09:02", etd: "Delayed" }))).toBe("departing");
      expect(await statusFor(departure({ std: "09:02", etd: undefined }))).toBe("departing");
    });

    it("has no status when the scheduled time is malformed", async () => {
      expect(await statusFor(departure({ std: "9:02", etd: undefined }))).toBeNull();
    });

    it("handles the window across midnight", async () => {
      freezeTime("2026-03-10T23:58:00.000Z");

      expect(await statusFor(departure({ std: "00:03", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "00:04", etd: "On time" }))).toBeNull();
      expect(await statusFor(departure({ std: "23:55", etd: "00:01" }))).toBe("departing");
    });

    it("handles the window just after midnight", async () => {
      freezeTime("2026-03-10T00:03:00.000Z");

      expect(await statusFor(departure({ std: "00:05", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "23:58", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "23:50", etd: "On time" }))).toBeNull();
    });

    it("uses London summer time (BST) for the current time", async () => {
      freezeTime("2026-07-01T08:00:00.000Z"); // 09:00 BST

      expect(await statusFor(departure({ std: "09:03", etd: "On time" }))).toBe("departing");
      expect(await statusFor(departure({ std: "08:03", etd: "On time" }))).toBeNull();
    });
  });

  describe("station messages", () => {
    it("strips HTML from NRCC messages and joins them", async () => {
      fetchMock.on(
        HOST,
        board([], {
          nrccMessages: [
            { Value: 'Disruption at <a href="https://nationalrail.co.uk">Watford</a>.' },
            { Value: "<p>Lifts   <b>out</b> of service</p>" },
          ],
        }),
      );

      const result = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(result.info).toBe("Disruption at Watford. | Lifts   out of service");
    });

    it("drops NRCC messages that are empty after stripping", async () => {
      fetchMock.on(
        HOST,
        board([], {
          nrccMessages: [{ Value: "<br/>" }, { Value: "  " }, { Value: "<i>Real</i>" }],
        }),
      );

      const result = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(result.info).toBe("Real");
    });

    it("has null info when there are no usable NRCC messages", async () => {
      fetchMock.once(HOST, board([], { nrccMessages: [{ Value: "<br/>" }] }));
      fetchMock.once(HOST, board([], { nrccMessages: [] }));

      expect((await scrapeUKTrains("GB1444", "departures", ENV)).info).toBeNull();
      expect((await scrapeUKTrains("GB1444", "departures", ENV)).info).toBeNull();
    });

    it("returns a notice and no trains when services are unavailable", async () => {
      fetchMock.on(
        HOST,
        board([departure()], { areServicesAvailable: false, nrccMessages: [{ Value: "ignored" }] }),
      );

      const result = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(result.trains).toEqual([]);
      expect(result.info).toBe("Services are currently unavailable at this station.");
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
    });

    it("treats a missing areServicesAvailable flag as available", async () => {
      fetchMock.on(HOST, jsonResponse({ trainServices: [departure()] }));

      const { trains } = await scrapeUKTrains("GB1444", "departures", ENV);

      expect(trains).toHaveLength(1);
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on(HOST, jsonResponse({ message: "unavailable" }, { status: 503 }));

      const error = await scrapeUKTrains("GB1444", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("UK"),
        upstream: { host: HOST, status: 503 },
      });
    });

    it("reports a rejected API key as 401", async () => {
      fetchMock.on(HOST, jsonResponse({ message: "Invalid key" }, { status: 401 }));

      const error = await scrapeUKTrains("GB1444", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("rejected our access"),
      });
    });

    it("reports an invalid JSON body as a 502", async () => {
      fetchMock.on(HOST, textResponse("<html>gateway</html>"));

      const error = await scrapeUKTrains("GB1444", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("UK") });
    });

    it("reports network failures as a 502", async () => {
      fetchMock.fail();

      const error = await scrapeUKTrains("GB1444", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("UK") });
    });
  });
});
