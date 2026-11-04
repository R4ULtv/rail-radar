import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeNetherlandsTrains } from "../../src/scrapers/netherlands";
import { freezeTime, jsonResponse, minutesFromNow, mockFetch, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Amsterdam (CET)
const ENV = { NS_API_KEY: "test-key" };

type Message = { message: string; style: string };

type Departure = {
  direction: string;
  name: string;
  plannedDateTime: string;
  actualDateTime?: string;
  plannedTrack?: string;
  actualTrack?: string;
  trainCategory: string;
  cancelled: boolean;
  messages: Message[];
  departureStatus: "ON_STATION" | "INCOMING" | "DEPARTED" | "UNKNOWN";
};

type Arrival = Omit<Departure, "direction" | "departureStatus"> & {
  origin: string;
  arrivalStatus: Departure["departureStatus"];
};

function departure(overrides: Partial<Departure> = {}): Departure {
  return {
    direction: "Utrecht Centraal",
    name: "IC  2256",
    plannedDateTime: minutesFromNow(20),
    plannedTrack: "5",
    trainCategory: "IC",
    cancelled: false,
    messages: [],
    departureStatus: "INCOMING",
    ...overrides,
  };
}

function arrival(overrides: Partial<Arrival> = {}): Arrival {
  return {
    origin: "Rotterdam Centraal",
    name: "IC  2256",
    plannedDateTime: minutesFromNow(20),
    plannedTrack: "5",
    trainCategory: "IC",
    cancelled: false,
    messages: [],
    arrivalStatus: "INCOMING",
    ...overrides,
  };
}

const departuresBody = (...departures: Departure[]) => ({ payload: { departures } });
const arrivalsBody = (...arrivals: Arrival[]) => ({ payload: { arrivals } });

describe("scrapeNetherlandsTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("API key", () => {
    it.each([
      ["no env", undefined],
      ["empty env", {}],
      ["empty key", { NS_API_KEY: "" }],
      ["non-string key", { NS_API_KEY: 123 }],
    ])("fails with a 500 ScraperError for %s without calling the upstream", async (_label, env) => {
      const error = await scrapeNetherlandsTrains("NL058", "departures", env).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 500, message: "NS API key is not configured." });
      expect(fetchMock.requests).toHaveLength(0);
    });

    it("sends the key in the subscription header", async () => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse(departuresBody()));

      await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(fetchMock.requests[0]?.headers.get("Ocp-Apim-Subscription-Key")).toBe("test-key");
    });
  });

  describe("request building", () => {
    it("requests departures with the 8400-prefixed UIC code", async () => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse(departuresBody()));

      await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(fetchMock.requests).toHaveLength(1);
      expect(fetchMock.requests[0]?.url).toBe(
        "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/departures?uicCode=8400058&lang=en&maxJourneys=16",
      );
    });

    it("defaults to departures and requests the arrivals endpoint when asked", async () => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse({ payload: {} }));

      await scrapeNetherlandsTrains("NL058", undefined, ENV);
      await scrapeNetherlandsTrains("NL058", "arrivals", ENV);

      expect(fetchMock.url(0).pathname).toBe("/reisinformatie-api/api/v2/departures");
      expect(fetchMock.url(1).pathname).toBe("/reisinformatie-api/api/v2/arrivals");
      expect(fetchMock.url(1).searchParams.get("uicCode")).toBe("8400058");
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({
              direction: "Eindhoven Centraal",
              name: "IC  2256",
              plannedDateTime: "2026-03-10T10:20:00+0100",
              actualDateTime: "2026-03-10T10:23:00+0100",
              plannedTrack: "5",
              actualTrack: "6",
              messages: [{ message: "Rear train departs later", style: "INFO" }],
            }),
          ),
        ),
      );

      const result = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "NS",
          category: "IC",
          trainNumber: "2256",
          destination: "Eindhoven Centraal",
          scheduledTime: "10:20",
          delay: 3,
          platform: "6",
          status: null,
          info: "Rear train departs later",
        },
      ]);
    });

    it("maps an arrival to a train using the origin", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          arrivalsBody(
            arrival({
              origin: "Rotterdam Centraal",
              name: "SPR  4043",
              trainCategory: "SPR",
              plannedDateTime: "2026-03-10T10:02:00+0100",
              plannedTrack: "12b",
            }),
          ),
        ),
      );

      const result = await scrapeNetherlandsTrains("NL058", "arrivals", ENV);

      expect(result.trains).toEqual([
        {
          brand: "NS",
          category: "SPR",
          trainNumber: "4043",
          origin: "Rotterdam Centraal",
          scheduledTime: "10:02",
          delay: null,
          platform: "12b",
          status: "incoming",
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("formats times in Amsterdam summer time", async () => {
      freezeTime("2026-07-10T09:00:00.000Z");
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(departuresBody(departure({ plannedDateTime: "2026-07-10T09:20:00Z" }))),
      );

      const [train] = (await scrapeNetherlandsTrains("NL058", "departures", ENV)).trains;

      expect(train?.scheduledTime).toBe("11:20");
    });

    it.each([
      ["SPR 4043", "4043"],
      ["IC  2256", "2256"],
      ["Int  9382", "9382"],
      ["NS703062", "703062"],
      ["Sprinter", "Sprinter"],
    ])("parses the train number from %j", async (name, expected) => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse(departuresBody(departure({ name }))));

      const [train] = (await scrapeNetherlandsTrains("NL058", "departures", ENV)).trains;

      expect(train?.trainNumber).toBe(expected);
    });

    it("resolves international brands from the train category, defaulting to NS", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({ trainCategory: "ICE" }),
            departure({ trainCategory: "EUR" }),
            departure({ trainCategory: " tgv " }),
            departure({ trainCategory: "THA" }),
            departure({ trainCategory: "ICD" }),
            departure({ trainCategory: "" }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.brand)).toEqual([
        "DB",
        "Eurostar",
        "SNCF",
        "Thalys",
        "NS",
        "NS",
      ]);
      expect(trains.map((train) => train.category)).toEqual([
        "ICE",
        "EUR",
        " tgv ",
        "THA",
        "ICD",
        null,
      ]);
    });

    it("joins all messages into the info field", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({
              messages: [
                { message: "Short train", style: "WARNING" },
                { message: "No bicycles", style: "INFO" },
              ],
            }),
            departure({ messages: [] }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.info)).toEqual(["Short train; No bicycles", null]);
    });

    it("prefers the actual track, then the planned one, then null", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({ plannedTrack: "5", actualTrack: "7" }),
            departure({ plannedTrack: "5" }),
            departure({ plannedTrack: undefined }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.platform)).toEqual(["7", "5", null]);
    });
  });

  describe("delay", () => {
    it("is the rounded difference in minutes between actual and planned time", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({
              plannedDateTime: "2026-03-10T10:20:00Z",
              actualDateTime: "2026-03-10T10:27:00Z",
            }),
            departure({
              plannedDateTime: "2026-03-10T10:20:00Z",
              actualDateTime: "2026-03-10T10:20:29Z",
            }),
            departure({
              plannedDateTime: "2026-03-10T10:20:00Z",
              actualDateTime: "2026-03-10T10:20:30Z",
            }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.delay)).toEqual([7, null, 1]);
    });

    it("is null for on-time, early or unknown actual times", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({
              plannedDateTime: "2026-03-10T10:20:00Z",
              actualDateTime: "2026-03-10T10:20:00Z",
            }),
            departure({
              plannedDateTime: "2026-03-10T10:20:00Z",
              actualDateTime: "2026-03-10T10:18:00Z",
            }),
            departure({ plannedDateTime: "2026-03-10T10:20:00Z" }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.delay)).toEqual([null, null, null]);
    });
  });

  describe("status", () => {
    it("marks cancelled trains as cancelled for both boards", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl/reisinformatie-api/api/v2/departures",
        jsonResponse(
          departuresBody(departure({ cancelled: true, plannedDateTime: minutesFromNow(1) })),
        ),
      );
      fetchMock.on(
        "gateway.apiportal.ns.nl/reisinformatie-api/api/v2/arrivals",
        jsonResponse(
          arrivalsBody(arrival({ cancelled: true, plannedDateTime: minutesFromNow(1) })),
        ),
      );

      const departures = await scrapeNetherlandsTrains("NL058", "departures", ENV);
      const arrivals = await scrapeNetherlandsTrains("NL058", "arrivals", ENV);

      expect(departures.trains[0]?.status).toBe("cancelled");
      expect(arrivals.trains[0]?.status).toBe("cancelled");
    });

    it("applies the 5-minute window to the actual time", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({ plannedDateTime: minutesFromNow(5) }),
            departure({ plannedDateTime: minutesFromNow(6) }),
            departure({ plannedDateTime: minutesFromNow(-5) }),
            // Planned 10 minutes ago, actually leaving in 2 minutes.
            departure({ plannedDateTime: minutesFromNow(-10), actualDateTime: minutesFromNow(2) }),
            // Planned in 2 minutes, but delayed beyond the window.
            departure({ plannedDateTime: minutesFromNow(2), actualDateTime: minutesFromNow(15) }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.status)).toEqual([
        "departing",
        null,
        "departing",
        "departing",
        null,
      ]);
    });

    it("is incoming for arrivals inside the window", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          arrivalsBody(
            arrival({ plannedDateTime: minutesFromNow(3) }),
            arrival({ plannedDateTime: minutesFromNow(25) }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "arrivals", ENV);

      expect(trains.map((train) => train.status)).toEqual(["incoming", null]);
    });
  });

  describe("filtering past trains", () => {
    it("drops departures older than 5 minutes unless cancelled or already departed", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({ name: "IC 1", plannedDateTime: minutesFromNow(-6) }),
            departure({ name: "IC 2", plannedDateTime: minutesFromNow(-5) }),
            departure({ name: "IC 3", plannedDateTime: minutesFromNow(-30), cancelled: true }),
            departure({
              name: "IC 4",
              plannedDateTime: minutesFromNow(-30),
              departureStatus: "DEPARTED",
            }),
            // Planned long ago but running late enough to still be on the board.
            departure({
              name: "IC 5",
              plannedDateTime: minutesFromNow(-20),
              actualDateTime: minutesFromNow(-4),
            }),
            departure({
              name: "IC 6",
              plannedDateTime: minutesFromNow(-2),
              actualDateTime: minutesFromNow(-8),
            }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "3", "4", "5"]);
    });

    it("drops arrivals older than 5 minutes unless cancelled or already departed", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          arrivalsBody(
            arrival({ name: "IC 1", plannedDateTime: minutesFromNow(-6) }),
            arrival({ name: "IC 2", plannedDateTime: minutesFromNow(-4) }),
            arrival({ name: "IC 3", plannedDateTime: minutesFromNow(-30), cancelled: true }),
            arrival({
              name: "IC 4",
              plannedDateTime: minutesFromNow(-30),
              arrivalStatus: "DEPARTED",
            }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "arrivals", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "3", "4"]);
    });

    it("keeps the order sent by the upstream", async () => {
      fetchMock.on(
        "gateway.apiportal.ns.nl",
        jsonResponse(
          departuresBody(
            departure({ name: "IC 2", plannedDateTime: minutesFromNow(30) }),
            departure({ name: "IC 1", plannedDateTime: minutesFromNow(10) }),
          ),
        ),
      );

      const { trains } = await scrapeNetherlandsTrains("NL058", "departures", ENV);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "1"]);
    });
  });

  describe("empty and malformed payloads", () => {
    it.each([
      ["empty list", { payload: { departures: [] } }],
      ["missing departures", { payload: {} }],
      ["missing payload", {}],
      ["null body", null],
    ])("returns an empty departure board for %s", async (_label, body) => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse(body));

      await expect(scrapeNetherlandsTrains("NL058", "departures", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it.each([
      ["empty list", { payload: { arrivals: [] } }],
      ["missing arrivals", { payload: {} }],
      ["missing payload", {}],
    ])("returns an empty arrival board for %s", async (_label, body) => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse(body));

      await expect(scrapeNetherlandsTrains("NL058", "arrivals", ENV)).resolves.toMatchObject({
        trains: [],
      });
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse({ message: "boom" }, { status: 503 }));

      const error = await scrapeNetherlandsTrains("NL058", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("Dutch"),
        upstream: { host: "gateway.apiportal.ns.nl", status: 503 },
      });
    });

    it("reports a rejected API key", async () => {
      fetchMock.on("gateway.apiportal.ns.nl", jsonResponse({ message: "denied" }, { status: 401 }));

      await expect(scrapeNetherlandsTrains("NL058", "departures", ENV)).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("rejected our access"),
      });
    });

    it("wraps network failures in a ScraperError", async () => {
      fetchMock.fail();

      await expect(scrapeNetherlandsTrains("NL058", "departures", ENV)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("Dutch"),
      });
    });
  });
});
