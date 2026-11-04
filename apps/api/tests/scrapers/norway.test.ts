import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeNorwayTrains } from "../../src/scrapers/norway";
import { freezeTime, jsonResponse, minutesFromNow, mockFetch, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Oslo (CET)
const ENTUR = "api.entur.io";

type Call = {
  realtime: boolean;
  cancellation: boolean;
  aimedArrivalTime: string;
  expectedArrivalTime: string;
  aimedDepartureTime: string;
  expectedDepartureTime: string;
  destinationDisplay?: { frontText?: string | null } | null;
  quay?: { publicCode?: string | null } | null;
  serviceJourney?: {
    privateCode?: string | null;
    journeyPattern?: {
      line?: {
        publicCode?: string | null;
        authority?: { name?: string | null } | null;
        operator?: { name?: string | null } | null;
        transportMode?: string | null;
      } | null;
    } | null;
  } | null;
  serviceJourneyEstimatedCalls?: {
    first?: { quay?: { stopPlace?: { name?: string | null } | null } | null } | null;
    last?: { quay?: { stopPlace?: { name?: string | null } | null } | null } | null;
  } | null;
};

function call(overrides: Partial<Call> = {}): Call {
  const time = minutesFromNow(20);
  return {
    realtime: true,
    cancellation: false,
    aimedArrivalTime: time,
    expectedArrivalTime: time,
    aimedDepartureTime: time,
    expectedDepartureTime: time,
    destinationDisplay: { frontText: "Bergen" },
    quay: { publicCode: "4" },
    serviceJourney: {
      privateCode: "601",
      journeyPattern: {
        line: {
          publicCode: "R20",
          authority: { name: "Vy" },
          operator: { name: "Vy Tog AS" },
          transportMode: "rail",
        },
      },
    },
    serviceJourneyEstimatedCalls: {
      first: { quay: { stopPlace: { name: "Oslo S" } } },
      last: { quay: { stopPlace: { name: "Bergen stasjon" } } },
    },
    ...overrides,
  };
}

/** A call whose line has the given authority/operator/mode. */
function callWithLine(
  line: NonNullable<NonNullable<Call["serviceJourney"]>["journeyPattern"]>["line"],
) {
  return call({ serviceJourney: { privateCode: "1", journeyPattern: { line } } });
}

const board = (...estimatedCalls: Call[]) => ({ data: { stopPlace: { estimatedCalls } } });

describe("scrapeNorwayTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("posts a GraphQL query for the stop place to Entur", async () => {
      fetchMock.on(ENTUR, jsonResponse(board()));

      await scrapeNorwayTrains("NO59872", "departures");

      expect(fetchMock.requests).toHaveLength(1);
      const request = fetchMock.requests[0]!;
      expect(request.method).toBe("POST");
      expect(request.url).toBe("https://api.entur.io/journey-planner/v3/graphql");
      expect(request.headers.get("Content-Type")).toBe("application/json");
      expect(request.headers.get("ET-Client-Name")).toBe("rail-radar");

      const body = JSON.parse(request.body!) as { query: string; variables: { id: string } };
      expect(body.variables).toEqual({ id: "NSR:StopPlace:59872" });
      expect(body.query).toContain("arrivalDeparture: departures");
      expect(body.query).toContain("numberOfDepartures: 16");
      expect(body.query).toContain("whiteListedModes: [rail, air]");
    });

    it("defaults to departures and asks for arrivals when requested", async () => {
      fetchMock.on(ENTUR, jsonResponse(board()));

      await scrapeNorwayTrains("NO59872");
      await scrapeNorwayTrains("NO59872", "arrivals");

      const queries = fetchMock.requests.map(
        (request) => (JSON.parse(request.body!) as { query: string }).query,
      );
      expect(queries[0]).toContain("arrivalDeparture: departures");
      expect(queries[1]).toContain("arrivalDeparture: arrivals");
    });

    it("rejects station ids without a numeric part without calling the upstream", async () => {
      const error = await scrapeNorwayTrains("NO").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404, message: "Unknown Norwegian station." });
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train, naming the destination from the last call of the journey", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              aimedDepartureTime: "2026-03-10T10:20:00+01:00",
              expectedDepartureTime: "2026-03-10T10:24:00+01:00",
              // Arrival times must be ignored on the departure board.
              aimedArrivalTime: "2026-03-10T10:19:00+01:00",
              expectedArrivalTime: "2026-03-10T10:19:00+01:00",
            }),
          ),
        ),
      );

      const result = await scrapeNorwayTrains("NO59872", "departures");

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "Vy",
          category: "R20",
          trainNumber: "601",
          destination: "Bergen stasjon",
          scheduledTime: "10:20",
          delay: 4,
          platform: "4",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival to a train, naming the origin from the first call of the journey", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              aimedArrivalTime: "2026-03-10T10:30:00+01:00",
              expectedArrivalTime: "2026-03-10T10:30:00+01:00",
              aimedDepartureTime: "2026-03-10T10:40:00+01:00",
              expectedDepartureTime: "2026-03-10T10:45:00+01:00",
            }),
          ),
        ),
      );

      const result = await scrapeNorwayTrains("NO59872", "arrivals");

      expect(result.trains).toEqual([
        {
          brand: "Vy",
          category: "R20",
          trainNumber: "601",
          origin: "Oslo S",
          scheduledTime: "10:30",
          delay: null,
          platform: "4",
          status: null,
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("formats times in Oslo summer time", async () => {
      freezeTime("2026-07-10T09:00:00.000Z");
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              aimedDepartureTime: "2026-07-10T09:20:00Z",
              expectedDepartureTime: "2026-07-10T09:20:00Z",
            }),
          ),
        ),
      );

      const [train] = (await scrapeNorwayTrains("NO59872")).trains;

      expect(train?.scheduledTime).toBe("11:20");
    });

    it("falls back to the display text for the destination, then to nothing", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              serviceJourneyEstimatedCalls: { last: { quay: { stopPlace: { name: null } } } },
              destinationDisplay: { frontText: "Stavanger" },
            }),
            call({ serviceJourneyEstimatedCalls: null, destinationDisplay: { frontText: null } }),
            call({ serviceJourneyEstimatedCalls: undefined, destinationDisplay: null }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872", "departures");

      expect(trains.map((train) => train.destination)).toEqual(["Stavanger", undefined, undefined]);
    });

    it("has no origin when the first call of the journey is unknown", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({ serviceJourneyEstimatedCalls: { first: null } }),
            call({ serviceJourneyEstimatedCalls: null }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872", "arrivals");

      expect(trains.map((train) => train.origin)).toEqual([undefined, undefined]);
    });

    it("shows the platform from the quay, or null", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({ quay: { publicCode: "12" } }),
            call({ quay: { publicCode: null } }),
            call({ quay: null }),
            call({ quay: undefined }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.platform)).toEqual(["12", null, null, null]);
    });

    it("flags scheduled-only data", async () => {
      fetchMock.on(ENTUR, jsonResponse(board(call({ realtime: false }), call({ realtime: true }))));

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.info)).toEqual(["Scheduled data only", null]);
    });

    it("keeps the order sent by the upstream", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              serviceJourney: {
                privateCode: "2",
                journeyPattern: { line: { transportMode: "rail" } },
              },
            }),
            call({
              serviceJourney: {
                privateCode: "1",
                journeyPattern: { line: { transportMode: "rail" } },
              },
            }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "1"]);
    });
  });

  describe("train number and category", () => {
    it("uses the service journey code, then the line code, then an empty string", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              serviceJourney: {
                privateCode: "601",
                journeyPattern: { line: { publicCode: "R20", transportMode: "rail" } },
              },
            }),
            call({
              serviceJourney: {
                privateCode: null,
                journeyPattern: { line: { publicCode: "FLY1", transportMode: "rail" } },
              },
            }),
            call({
              serviceJourney: {
                privateCode: null,
                journeyPattern: { line: { publicCode: null, transportMode: "rail" } },
              },
            }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => [train.trainNumber, train.category])).toEqual([
        ["601", "R20"],
        ["FLY1", "FLY1"],
        ["", null],
      ]);
    });
  });

  describe("brand", () => {
    it.each([
      [" VY ", "Vy"],
      ["SJ", "SJ NORD"],
      ["Go-Ahead Norge AS", "Go-Ahead Norge"],
      ["Go-Ahead Nordic AS", "Go-Ahead Norge"],
      ["Flytoget", "Flytoget"],
      ["Norske Tog", "Norske Tog"],
    ])("normalises authority %j to %j", async (authority, expected) => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            callWithLine({
              transportMode: "rail",
              authority: { name: authority },
              operator: { name: "Ignored" },
            }),
          ),
        ),
      );

      const [train] = (await scrapeNorwayTrains("NO59872")).trains;

      expect(train?.brand).toBe(expected);
    });

    it("falls back to the operator when there is no authority", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            callWithLine({ transportMode: "rail", authority: null, operator: { name: "SJ" } }),
            callWithLine({ transportMode: "rail", operator: { name: "Unknown Operator" } }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.brand)).toEqual(["SJ NORD", "Unknown Operator"]);
    });

    it("is null when neither authority nor operator is known", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            callWithLine({ transportMode: "rail", authority: null, operator: null }),
            callWithLine({ transportMode: "rail" }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.brand)).toEqual([null, null]);
    });
  });

  describe("delay", () => {
    it("is the rounded positive difference between expected and aimed departure", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              aimedDepartureTime: "2026-03-10T10:20:00Z",
              expectedDepartureTime: "2026-03-10T10:27:00Z",
            }),
            call({
              aimedDepartureTime: "2026-03-10T10:20:00Z",
              expectedDepartureTime: "2026-03-10T10:20:00Z",
            }),
            call({
              aimedDepartureTime: "2026-03-10T10:20:00Z",
              expectedDepartureTime: "2026-03-10T10:18:00Z",
            }),
            call({
              aimedDepartureTime: "2026-03-10T10:20:00Z",
              expectedDepartureTime: "2026-03-10T10:20:40Z",
            }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872", "departures");

      expect(trains.map((train) => train.delay)).toEqual([7, null, null, 1]);
    });

    it("uses the arrival times on the arrivals board", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              aimedArrivalTime: "2026-03-10T10:20:00Z",
              expectedArrivalTime: "2026-03-10T10:25:00Z",
              aimedDepartureTime: "2026-03-10T10:20:00Z",
              expectedDepartureTime: "2026-03-10T10:20:00Z",
            }),
          ),
        ),
      );

      const [train] = (await scrapeNorwayTrains("NO59872", "arrivals")).trains;

      expect(train?.delay).toBe(5);
    });
  });

  describe("status", () => {
    it("is cancelled for cancelled calls, whatever the time", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              cancellation: true,
              expectedDepartureTime: minutesFromNow(1),
              aimedDepartureTime: minutesFromNow(1),
            }),
            call({ cancellation: true }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.status)).toEqual(["cancelled", "cancelled"]);
    });

    it("applies the 5-minute window to the expected departure time", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({ expectedDepartureTime: minutesFromNow(5) }),
            call({ expectedDepartureTime: minutesFromNow(6) }),
            call({ expectedDepartureTime: minutesFromNow(-5) }),
            call({ expectedDepartureTime: minutesFromNow(-6) }),
            // Aimed time is far away, but the train is expected shortly.
            call({
              aimedDepartureTime: minutesFromNow(-30),
              expectedDepartureTime: minutesFromNow(1),
            }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872", "departures");

      expect(trains.map((train) => train.status)).toEqual([
        "departing",
        null,
        "departing",
        null,
        "departing",
      ]);
    });

    it("is incoming for arrivals inside the window and uses the arrival time", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            call({
              expectedArrivalTime: minutesFromNow(2),
              expectedDepartureTime: minutesFromNow(60),
            }),
            call({
              expectedArrivalTime: minutesFromNow(60),
              expectedDepartureTime: minutesFromNow(2),
            }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872", "arrivals");

      expect(trains.map((train) => train.status)).toEqual(["incoming", null]);
    });
  });

  describe("transport modes", () => {
    it("keeps rail and air calls and drops everything else", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse(
          board(
            callWithLine({ transportMode: "rail", publicCode: "R" }),
            callWithLine({ transportMode: "air", publicCode: "FLY" }),
            callWithLine({ transportMode: "bus", publicCode: "B" }),
            callWithLine({ transportMode: "metro", publicCode: "M" }),
            callWithLine({ transportMode: null, publicCode: "N" }),
            callWithLine({ publicCode: "U" }),
            callWithLine(null),
            call({ serviceJourney: null }),
          ),
        ),
      );

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains.map((train) => train.category)).toEqual(["R", "FLY"]);
    });
  });

  describe("errors", () => {
    it("returns an empty board when there are no calls", async () => {
      fetchMock.on(ENTUR, jsonResponse(board()));

      await expect(scrapeNorwayTrains("NO59872")).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it("surfaces GraphQL errors as a bad gateway ScraperError", async () => {
      fetchMock.on(
        ENTUR,
        jsonResponse({ errors: [{ message: "Variable 'id' is invalid" }, { message: "Second" }] }),
      );

      const error = await scrapeNorwayTrains("NO59872").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 502, message: "Variable 'id' is invalid" });
      expect((error as ScraperError).timing?.fetchMs).toBeGreaterThanOrEqual(0);
    });

    it("uses a generic message for GraphQL errors without text", async () => {
      fetchMock.on(ENTUR, jsonResponse({ errors: [{}] }));

      await expect(scrapeNorwayTrains("NO59872")).rejects.toMatchObject({
        statusCode: 502,
        message: "Entur query failed.",
      });
    });

    it("ignores an empty errors array", async () => {
      fetchMock.on(ENTUR, jsonResponse({ errors: [], ...board(call()) }));

      const { trains } = await scrapeNorwayTrains("NO59872");

      expect(trains).toHaveLength(1);
    });

    it.each([
      ["unknown stop place", { data: { stopPlace: null } }],
      ["no data", {}],
      ["no estimated calls", { data: { stopPlace: {} } }],
    ])("reports %s as a 404", async (_label, body) => {
      fetchMock.on(ENTUR, jsonResponse(body));

      const error = await scrapeNorwayTrains("NO59872").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404, message: "Unknown Norwegian station." });
    });

    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on(ENTUR, jsonResponse({}, { status: 503 }));

      const error = await scrapeNorwayTrains("NO59872").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("Norwegian"),
        upstream: { host: "api.entur.io", status: 503 },
      });
    });

    it("wraps network failures in a ScraperError", async () => {
      fetchMock.fail();

      await expect(scrapeNorwayTrains("NO59872")).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("Norwegian"),
      });
    });
  });
});
