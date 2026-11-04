import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeDenmarkTrains } from "../../src/scrapers/denmark";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Copenhagen (CET)
const ENV = { REJSEPLANEN_API_KEY: "key" };
const HOST = "www.rejseplanen.dk/api";

type Entry = Record<string, unknown>;

/** A departure shaped like Rejseplanen's HAFAS board entries; arrivals reuse it via overrides. */
function entry(overrides: Entry = {}): Entry {
  return {
    name: "IC 123",
    type: "DEP",
    date: "2026-03-10",
    time: "10:20:00",
    direction: "Aarhus H",
    track: "4",
    ProductAtStop: {
      name: "IC 123",
      displayNumber: "123",
      num: "123",
      catOutS: "IC",
      catOut: "IC",
      catOutL: "InterCity",
      operator: "DSB",
    },
    ...overrides,
  };
}

/** A departure whose train number (and so dedupe key) is unique per `id`. */
function numbered(id: number | string, overrides: Entry = {}): Entry {
  return entry({ name: `IC ${id}`, ProductAtStop: { displayNumber: String(id) }, ...overrides });
}

function departures(...entries: Entry[]) {
  return jsonResponse({ Departure: entries });
}

describe("scrapeDenmarkTrains", () => {
  let fetchMock: FetchMock;

  async function scrape(
    entries: Entry[],
    type: "departures" | "arrivals" = "departures",
  ): Promise<Awaited<ReturnType<typeof scrapeDenmarkTrains>>> {
    fetchMock.on(
      HOST,
      jsonResponse(type === "departures" ? { Departure: entries } : { Arrival: entries }),
    );
    return scrapeDenmarkTrains("DK00626", type, ENV);
  }

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("requests the departure board with the converted station id and bearer key", async () => {
      fetchMock.on(HOST, departures());

      await scrapeDenmarkTrains("DK00626", "departures", ENV);

      expect(fetchMock.requests).toHaveLength(1);
      const url = fetchMock.url();
      expect(url.origin + url.pathname).toBe("https://www.rejseplanen.dk/api/departureBoard");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        format: "json",
        lang: "en",
        id: "8600626",
        type: "DEP_STATION",
        maxJourneys: "24",
      });
      const { headers } = fetchMock.requests[0]!;
      expect(headers.get("authorization")).toBe("Bearer key");
      expect(headers.get("accept")).toBe("application/json");
    });

    it("requests the arrival board for arrivals", async () => {
      fetchMock.on(HOST, jsonResponse({ Arrival: [] }));

      await scrapeDenmarkTrains("DK00626", "arrivals", ENV);

      const url = fetchMock.url();
      expect(url.pathname).toBe("/api/arrivalBoard");
      expect(url.searchParams.get("type")).toBe("ARR_STATION");
    });

    it("defaults to departures", async () => {
      fetchMock.on(HOST, departures());

      await scrapeDenmarkTrains("DK00626", undefined, ENV);

      expect(fetchMock.url().pathname).toBe("/api/departureBoard");
    });

    it.each([undefined, {}, { REJSEPLANEN_API_KEY: "" }, { REJSEPLANEN_API_KEY: 42 }])(
      "fails with a 500 when the API key is missing (%j)",
      async (env) => {
        const error = await scrapeDenmarkTrains("DK00626", "departures", env).catch(
          (error: unknown) => error,
        );

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 500,
          message: "Rejseplanen API key is not configured.",
        });
        expect(fetchMock.requests).toHaveLength(0);
      },
    );

    it.each(["DK626", "DK0062600", "SE00626", "dk00626", "DK0062A", ""])(
      "rejects the malformed station id %j with a 400",
      async (id) => {
        const error = await scrapeDenmarkTrains(id, "departures", ENV).catch(
          (error: unknown) => error,
        );

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 400,
          message: `Unknown Danish station ID: ${id}`,
        });
        expect(fetchMock.requests).toHaveLength(0);
      },
    );
  });

  describe("response mapping", () => {
    it("maps a departure to a train", async () => {
      const result = await scrape([
        entry({ rtTime: "10:23:00", rtDate: "2026-03-10", rtTrack: "5", date: "2026-03-10" }),
      ]);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "DSB",
          category: "IC",
          trainNumber: "123",
          destination: "Aarhus H",
          scheduledTime: "10:20",
          delay: 3,
          platform: "5",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival with its origin instead of a destination", async () => {
      const result = await scrape(
        [
          entry({
            type: "ARR",
            direction: undefined,
            origin: "Odense St.",
            time: "10:03:00",
            platform: "2",
          }),
        ],
        "arrivals",
      );

      expect(result.trains).toEqual([
        {
          brand: "DSB",
          category: "IC",
          trainNumber: "123",
          origin: "Odense St.",
          scheduledTime: "10:03",
          delay: null,
          platform: "2",
          status: "incoming",
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("prefers OriginStop over the plain origin field for arrivals", async () => {
      const { trains } = await scrape(
        [entry({ OriginStop: [{ name: "Kolding St." }], origin: "Ignored" })],
        "arrivals",
      );

      expect(trains[0]?.origin).toBe("Kolding St.");
    });

    it("falls back to nested destination fields for departures", async () => {
      const { trains } = await scrape([
        entry({ direction: undefined, DestinationStop: { name: "Esbjerg St." } }),
        entry({ name: "IC 124", direction: undefined, Directions: [{ text: "Fredericia" }] }),
        entry({ name: "IC 125", direction: undefined }),
      ]);

      expect(trains.map((train) => train.destination)).toEqual([
        "Esbjerg St.",
        "Fredericia",
        undefined,
      ]);
    });

    it("accepts the board wrapped in DepartureBoard", async () => {
      fetchMock.on(HOST, jsonResponse({ DepartureBoard: { Departure: [entry()] } }));

      const { trains } = await scrapeDenmarkTrains("DK00626", "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("accepts a single entry object instead of an array", async () => {
      fetchMock.on(HOST, jsonResponse({ Departure: entry() }));

      const { trains } = await scrapeDenmarkTrains("DK00626", "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("falls back to top-level entries when the wrapped board is empty", async () => {
      fetchMock.on(HOST, jsonResponse({ DepartureBoard: { note: "none" }, Departure: [entry()] }));

      const { trains } = await scrapeDenmarkTrains("DK00626", "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("ignores non-object entries in the board", async () => {
      fetchMock.on(HOST, jsonResponse({ Departure: ["x", null, 5, entry()] }));

      const { trains } = await scrapeDenmarkTrains("DK00626", "departures", ENV);

      expect(trains).toHaveLength(1);
    });

    it("also reads the Product array", async () => {
      const { trains } = await scrape([
        entry({
          name: "RE 4512",
          ProductAtStop: undefined,
          Product: [{ displayNumber: "4512", catOutS: "RE", operator: "DSB" }],
        }),
      ]);

      expect(trains[0]).toMatchObject({ brand: "DSB", category: "RE", trainNumber: "4512" });
    });

    it("returns an empty board for an empty or entry-less response", async () => {
      fetchMock.on(HOST, jsonResponse({}));

      await expect(scrapeDenmarkTrains("DK00626", "departures", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });

    it.each([[null], [[]], ["oops"], [42]])(
      "throws a 502 when the payload is not an object (%j)",
      async (payload) => {
        fetchMock.on(HOST, jsonResponse(payload));

        const error = await scrapeDenmarkTrains("DK00626", "departures", ENV).catch(
          (error: unknown) => error,
        );

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 502,
          message: "Invalid response from the Danish train data source.",
        });
      },
    );
  });

  describe("non-rail filtering", () => {
    it("drops buses, metro, light rail, trams and ferries", async () => {
      const bus = { name: "Bus 5A", catOut: "Bus" };
      const metro = { name: "M3", catOut: "Metro" };
      const letbane = { name: "Letbane 1", catOut: "Letbane" };
      const ferry = { name: "Ferry 9", catOut: "Ferry" };
      const { trains } = await scrape([
        entry({ name: "Bus 5A", ProductAtStop: bus }),
        entry({ name: "M3", ProductAtStop: metro }),
        entry({ name: "Letbane 1", ProductAtStop: letbane }),
        entry({ name: "Ferry 9", ProductAtStop: ferry }),
        entry({ name: "Tram 7", ProductAtStop: undefined }),
        entry({ name: "IC 123" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["123"]);
    });

    it("keeps entries that carry no product information", async () => {
      const { trains } = await scrape([
        { time: "10:20:00", date: "2026-03-10", direction: "Aarhus H" },
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ brand: null, category: null, trainNumber: "Unknown" });
    });
  });

  describe("brand", () => {
    const brandFor = async (product: Entry, name = "X 1") => {
      const { trains } = await scrape([entry({ name, ProductAtStop: product })]);
      return trains[0]?.brand;
    };

    it.each([
      [{ operatorInfo: { name: "S-tog" } }, "DSB"],
      [{ operator: "Øresundståg" }, "Øresundståg"],
      [{ operator: "Skånetrafiken" }, "Skånetrafiken"],
      [{ operator: "Vores Tog" }, "DSB Vores Tog"],
      [{ operator: "GoCollective" }, "DSB Vores Tog"],
      [{ operator: "Arriva Tog" }, "DSB Vores Tog"],
      [{ operator: "Nordjyske Jernbaner" }, "NJ"],
      [{ operator: "NJ" }, "NJ"],
      [{ operator: "Lokaltog A/S" }, "Lokaltog"],
      [{ operator: "Midtjyske Jernbaner" }, "Midtjyske Jernbaner"],
      [{ operator: "Snälltåg" }, "Snälltåget"],
      [{ operator: "SJ" }, "SJ"],
      [{ operator: "DSB Fjern" }, "DSB"],
    ])("normalises operator %j to %s", async (product, brand) => {
      expect(await brandFor(product)).toBe(brand);
    });

    it("prefers operatorInfo over operator", async () => {
      expect(await brandFor({ operatorInfo: { text: "Lokaltog" }, operator: "DSB" })).toBe(
        "Lokaltog",
      );
    });

    it("passes unknown operators through unchanged", async () => {
      expect(await brandFor({ operator: "Regional Rail Co" })).toBe("Regional Rail Co");
    });

    it("derives the brand from the product name when no operator is given", async () => {
      expect(await brandFor({ name: "Vy 1234" }, "Vy 1234")).toBe("Vy");
    });

    it("derives the brand from the entry name when the product has no text", async () => {
      expect(await brandFor({}, "S-tog A")).toBe("DSB");
    });

    it("is null when nothing identifies an operator", async () => {
      expect(await brandFor({ catOutS: "RE" }, "RE 1")).toBeNull();
    });
  });

  describe("category and train number", () => {
    it("uses short category codes directly", async () => {
      const { trains } = await scrape([
        entry({ ProductAtStop: { catOutS: "ICL", catOut: "Intercitylyn" } }),
        entry({ name: "Re 1", ProductAtStop: { catOutS: "RE+", operator: "DSB" } }),
      ]);

      expect(trains.map((train) => train.category)).toEqual(["ICL", "RE+"]);
    });

    it("maps long category names to their short form", async () => {
      const long = (catOut: string) => entry({ ProductAtStop: { catOut } });
      const { trains } = await scrape([
        long("Intercity"),
        { ...long("Intercitylyn"), name: "ICL 5" },
        { ...long("S-tog"), name: "S-tog A" },
        { ...long("S-train"), name: "S-train B" },
      ]);

      expect(trains.map((train) => train.category)).toEqual(["IC", "ICL", "S", "S"]);
    });

    it("strips a trailing train number from the category label", async () => {
      const { trains } = await scrape([
        entry({
          name: "Regionaltog 4512",
          ProductAtStop: { name: "Regionaltog 4512", displayNumber: "4512", operator: "DSB" },
        }),
      ]);

      expect(trains[0]).toMatchObject({ category: "Regionaltog", trainNumber: "4512" });
    });

    it("skips code-like category candidates", async () => {
      const { trains } = await scrape([
        entry({ ProductAtStop: { name: "123456", catIn: "00:15", internalName: "Lyntog" } }),
      ]);

      expect(trains[0]?.category).toBe("Lyntog");
    });

    it("falls back to S for S-tog entries without a product", async () => {
      const { trains } = await scrape([entry({ name: "S-tog A", ProductAtStop: undefined })]);

      expect(trains[0]).toMatchObject({ category: "S", brand: "DSB", trainNumber: "A" });
    });

    it("has no category without any usable product text", async () => {
      const { trains } = await scrape([entry({ ProductAtStop: { name: "123" } })]);

      expect(trains[0]?.category).toBeNull();
    });

    it("parses the number from entry names with and without a space", async () => {
      const { trains } = await scrape([
        entry({ name: "IC123", ProductAtStop: undefined }),
        entry({ name: "IC 124", ProductAtStop: undefined }),
        entry({ name: "Re1234A", ProductAtStop: undefined }),
        entry({ name: "E10", ProductAtStop: undefined }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["123", "124", "1234A", "E10"]);
    });

    it("takes the train number from num, then from the entry name, then from the line", async () => {
      const { trains } = await scrape([
        entry({ name: "IC 999", ProductAtStop: { num: "77" } }),
        entry({ name: "IC 999", ProductAtStop: { catOutS: "IC" } }),
        entry({ name: "Stog", ProductAtStop: { line: "B" } }),
        entry({ name: "Stog", ProductAtStop: undefined }),
        entry({ name: undefined, ProductAtStop: undefined }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual([
        "77",
        "999",
        "B",
        "Stog",
        "Unknown",
      ]);
    });
  });

  describe("platform", () => {
    it("prefers the real-time platform and normalises whitespace", async () => {
      const { trains } = await scrape([
        numbered(1, { rtPlatform: { text: "  7  " }, platform: "3", track: "1" }),
        numbered(2, { platform: "3", rtTrack: "9", track: "1" }),
        numbered(3, { track: { value: "B" } }),
      ]);

      expect(trains.map((train) => train.platform)).toEqual(["7", "3", "B"]);
    });

    it("is null when missing or only a placeholder", async () => {
      const { trains } = await scrape([
        numbered(1, { track: undefined }),
        numbered(2, { track: "PL" }),
        numbered(3, { track: "track" }),
        numbered(4, { track: "   " }),
      ]);

      expect(trains.map((train) => train.platform)).toEqual([null, null, null, null]);
    });
  });

  describe("info", () => {
    it("joins up to three unique human-readable notes", async () => {
      const { trains } = await scrape([
        entry({
          Notes: {
            Note: [
              { value: "Bicycle reservation required", key: "BR", type: "R" },
              { value: "Bicycle reservation required" },
              { value: "Wi-Fi onboard" },
            ],
          },
          Messages: { Message: [{ text: "Replacement bus between A and B", id: "1" }] },
          Message: [{ header: "Extra" }],
        }),
      ]);

      expect(trains[0]?.info).toBe(
        "Bicycle reservation required; Wi-Fi onboard; Replacement bus between A and B",
      );
    });

    it("drops code-like and one-character notes", async () => {
      const { trains } = await scrape([
        entry({
          Notes: {
            Note: [{ value: "123" }, { value: "AB" }, { value: "x" }, { value: "text.foo" }],
          },
        }),
      ]);

      expect(trains[0]?.info).toBeNull();
    });

    it("skips bookkeeping keys on records without a text field", async () => {
      const { trains } = await scrape([
        entry({ Notes: [{ id: "Hello there", time: "Nope here", other: "Track change" }] }),
      ]);

      expect(trains[0]?.info).toBe("Track change");
    });
  });

  describe("time, delay and status", () => {
    it("normalises the scheduled time and tolerates missing values", async () => {
      const { trains } = await scrape([
        entry({ name: "IC 1", time: "9:05" }),
        entry({ name: "IC 2", time: undefined }),
        entry({ name: "IC 3", time: "soon" }),
      ]);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["09:05", "--:--", "soon"]);
      expect(trains.map((train) => train.status)).toEqual([null, null, null]);
    });

    it("computes the delay in minutes from the real-time time", async () => {
      const { trains } = await scrape([
        numbered(1, { time: "09:50:00", rtTime: "10:03:00" }),
        numbered(2, { time: "10:30:00", rtTime: "10:30:00" }),
        numbered(3, { time: "10:30:00", rtTime: "10:25:00" }),
        numbered(4, { time: "10:30:00" }),
        numbered(5, { time: "10:30:00", rtTime: "garbage" }),
      ]);

      expect(trains.map((train) => train.delay)).toEqual([13, null, null, null, null]);
    });

    it("computes the delay across midnight using the real-time date", async () => {
      const { trains } = await scrape([
        entry({ time: "23:55:00", date: "2026-03-10", rtTime: "00:05:00", rtDate: "2026-03-11" }),
      ]);

      expect(trains[0]?.delay).toBe(10);
    });

    it.each(["2026-03-10", "20260310", "10.03.2026", "10.03.26"])(
      "understands the date format %s",
      async (date) => {
        const { trains } = await scrape([entry({ date, time: "10:03:00" })]);

        expect(trains[0]?.status).toBe("departing");
      },
    );

    it("treats unparseable dates as having no status or delay", async () => {
      const { trains } = await scrape([
        numbered(1, { date: "tomorrow", time: "10:03:00", rtTime: "10:10:00" }),
        numbered(2, { date: undefined, time: "10:03:00" }),
      ]);

      expect(trains.map((train) => [train.status, train.delay])).toEqual([
        [null, null],
        [null, null],
      ]);
    });

    it.each([
      ["09:54:00", null],
      ["09:55:00", "departing"],
      ["10:00:00", "departing"],
      ["10:05:00", "departing"],
      ["10:06:00", null],
    ])("derives a departure status for %s relative to local now", async (time, status) => {
      const { trains } = await scrape([entry({ time })]);

      expect(trains[0]?.status).toBe(status);
    });

    it("uses incoming for arrivals inside the window", async () => {
      const { trains } = await scrape(
        [entry({ time: "10:05:00" }), entry({ name: "IC 2", time: "10:06:00" })],
        "arrivals",
      );

      expect(trains.map((train) => train.status)).toEqual(["incoming", null]);
    });

    it("judges the status by the real-time time rather than the schedule", async () => {
      const { trains } = await scrape([
        // Scheduled in the window but delayed out of it.
        entry({ name: "IC 1", time: "10:02:00", rtTime: "10:30:00" }),
        // Scheduled long ago but now running within the window.
        entry({ name: "IC 2", time: "09:30:00", rtTime: "10:02:00" }),
      ]);

      expect(trains.map((train) => train.status)).toEqual([null, "departing"]);
    });

    it.each([true, "true", "1", "Yes", 1])("marks cancelled=%j as cancelled", async (cancelled) => {
      const { trains } = await scrape([entry({ cancelled })]);

      expect(trains[0]?.status).toBe("cancelled");
    });

    it.each([false, "false", 0, "no", null])(
      "does not cancel for cancelled=%j",
      async (cancelled) => {
        const { trains } = await scrape([entry({ cancelled, time: "11:00:00" })]);

        expect(trains[0]?.status).toBeNull();
      },
    );

    it("compares against Copenhagen summer time (CEST)", async () => {
      vi.setSystemTime(new Date("2026-07-10T08:00:00Z")); // 10:00 CEST
      const { trains } = await scrape([
        entry({ name: "IC 1", date: "2026-07-10", time: "10:03:00" }),
        // 09:03 would be "now" if the scraper wrongly used CET.
        entry({ name: "IC 2", date: "2026-07-10", time: "09:03:00" }),
      ]);

      expect(trains.map((train) => train.status)).toEqual(["departing", null]);
    });

    it("rolls the local date over at midnight", async () => {
      vi.setSystemTime(new Date("2026-03-10T23:58:00Z")); // 00:58 on 11 March in Copenhagen
      const { trains } = await scrape([
        entry({ name: "IC 1", date: "2026-03-11", time: "01:00:00" }),
        entry({ name: "IC 2", date: "2026-03-10", time: "23:58:00" }),
      ]);

      expect(trains.map((train) => train.status)).toEqual(["departing", null]);
    });
  });

  describe("deduplication and limits", () => {
    it("removes duplicates of the same train, time and destination", async () => {
      const { trains } = await scrape([
        entry(),
        entry(),
        entry({ direction: "Aalborg" }),
        entry({ time: "10:40:00" }),
      ]);

      expect(trains.map((train) => [train.scheduledTime, train.destination])).toEqual([
        ["10:20", "Aarhus H"],
        ["10:20", "Aalborg"],
        ["10:40", "Aarhus H"],
      ]);
    });

    it("keeps the upstream order instead of sorting", async () => {
      const { trains } = await scrape([
        entry({ name: "IC 2", time: "11:00:00", ProductAtStop: { displayNumber: "2" } }),
        entry({ name: "IC 1", time: "10:00:00", ProductAtStop: { displayNumber: "1" } }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "1"]);
    });

    it("limits the board to 24 trains", async () => {
      const many = Array.from({ length: 30 }, (_, index) =>
        entry({ name: `IC ${index}`, ProductAtStop: { displayNumber: String(index) } }),
      );

      const { trains } = await scrape(many);

      expect(trains).toHaveLength(24);
      expect(trains[23]?.trainNumber).toBe("23");
    });
  });

  describe("errors", () => {
    it.each([
      [401, "rejected our access"],
      [429, "request limit"],
      [503, "temporarily unavailable"],
    ])("wraps upstream HTTP %i in a ScraperError", async (status, text) => {
      fetchMock.on(HOST, jsonResponse({ error: "x" }, { status }));

      const error = await scrapeDenmarkTrains("DK00626", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: status,
        message: expect.stringContaining("Danish"),
        upstream: { host: "www.rejseplanen.dk", path: "/api/departureBoard", status },
      });
      expect((error as ScraperError).message).toContain(text);
    });

    it("maps unparseable JSON to a 502", async () => {
      fetchMock.on(HOST, textResponse("<html>not json</html>"));

      const error = await scrapeDenmarkTrains("DK00626", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Danish") });
    });

    it("maps network failures to a 502", async () => {
      fetchMock.fail();

      const error = await scrapeDenmarkTrains("DK00626", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Danish") });
    });
  });
});
