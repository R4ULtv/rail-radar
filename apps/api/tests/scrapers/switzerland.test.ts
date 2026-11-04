import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeSwissTrains } from "../../src/scrapers/switzerland";
import {
  freezeTime,
  jsonResponse,
  minutesFromNow,
  mockFetch,
  textResponse,
  type FetchMock,
} from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Zurich (CET)

type Stop = {
  station: { name: string | null };
  arrival: string | null;
  departure: string | null;
  delay: number | null;
  platform: string | null;
  prognosis: { platform: string | null };
};

type Entry = {
  stop: Stop;
  category: string;
  number: string | null;
  name: string | null;
  operator: string;
  to: string;
  passList: Stop[];
};

function stop(overrides: Partial<Stop> = {}): Stop {
  return {
    station: { name: "Zürich HB" },
    arrival: null,
    departure: minutesFromNow(20),
    delay: 0,
    platform: "7",
    prognosis: { platform: null },
    ...overrides,
  };
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    stop: stop(),
    category: "IC",
    number: "8",
    name: "IC 8",
    operator: "SBB",
    to: "Bern",
    passList: [],
    ...overrides,
  };
}

describe("scrapeSwissTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the departure stationboard with the 85-prefixed station id", async () => {
    fetchMock.on("transport.opendata.ch", jsonResponse({ stationboard: [] }));

    await scrapeSwissTrains("CH06013", "departures");

    expect(fetchMock.requests).toHaveLength(1);
    expect(fetchMock.requests[0]?.url).toBe(
      "https://transport.opendata.ch/v1/stationboard?id=8506013&type=departure&limit=16&transportations=train",
    );
  });

  it("defaults to departures and asks for arrivals when requested", async () => {
    fetchMock.on("transport.opendata.ch", jsonResponse({ stationboard: [] }));

    await scrapeSwissTrains("CH06013");
    await scrapeSwissTrains("CH06013", "arrivals");

    expect(fetchMock.url(0).searchParams.get("type")).toBe("departure");
    expect(fetchMock.url(1).searchParams.get("type")).toBe("arrival");
  });

  it("maps a departure to a train", async () => {
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [
          entry({
            stop: stop({
              departure: "2026-03-10T10:20:00+0100",
              delay: 3,
              platform: "7",
              prognosis: { platform: "8" },
            }),
            operator: "SBB-CFF-FFS",
            to: "Bern",
          }),
        ],
      }),
    );

    const result = await scrapeSwissTrains("CH06013", "departures");

    expect(result.info).toBeNull();
    expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
    expect(result.trains).toEqual([
      {
        brand: "SBB",
        category: "IC",
        trainNumber: "IC 8",
        destination: "Bern",
        scheduledTime: "10:20",
        delay: 3,
        platform: "8",
        status: null,
        info: null,
      },
    ]);
  });

  it("maps an arrival to a train using the last named pass-list station as origin", async () => {
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [
          entry({
            stop: stop({ departure: "2026-03-10T10:30:00+0100", delay: null, platform: "12" }),
            category: "RE",
            number: null,
            name: "RE 4321",
            operator: "BLS",
            to: "Zürich HB",
            passList: [
              stop({ station: { name: "Zürich HB" } }),
              stop({ station: { name: "Olten" } }),
              stop({ station: { name: "Bern" } }),
              stop({ station: { name: null } }),
            ],
          }),
        ],
      }),
    );

    const { trains } = await scrapeSwissTrains("CH06013", "arrivals");

    expect(trains).toEqual([
      {
        brand: "BLS",
        category: "RE",
        trainNumber: "RE 4321",
        origin: "Bern",
        scheduledTime: "10:30",
        delay: null,
        platform: "12",
        status: null,
        info: null,
      },
    ]);
    expect(trains[0]).not.toHaveProperty("destination");
  });

  it("falls back to arrival time and to the 'to' field when the pass list has no names", async () => {
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [
          entry({
            stop: stop({ departure: null, arrival: "2026-03-10T10:45:00+0100" }),
            to: "Basel SBB",
            passList: [stop({ station: { name: null } })],
          }),
          entry({ to: "Genève", passList: undefined as unknown as Stop[] }),
        ],
      }),
    );

    const { trains } = await scrapeSwissTrains("CH06013", "arrivals");

    expect(trains.map((train) => [train.scheduledTime, train.origin])).toEqual([
      ["10:45", "Basel SBB"],
      ["10:20", "Genève"],
    ]);
  });

  it("shows --:-- for departures without a departure time", async () => {
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [entry({ stop: stop({ departure: null, arrival: minutesFromNow(1) }) })],
      }),
    );

    const [train] = (await scrapeSwissTrains("CH06013", "departures")).trains;

    expect(train?.scheduledTime).toBe("--:--");
    // Status still falls back to the arrival time.
    expect(train?.status).toBe("departing");
  });

  it("formats times in Zurich summer time", async () => {
    freezeTime("2026-07-10T09:00:00.000Z");
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [entry({ stop: stop({ departure: "2026-07-10T09:20:00Z" }) })],
      }),
    );

    const [train] = (await scrapeSwissTrains("CH06013")).trains;

    expect(train?.scheduledTime).toBe("11:20");
  });

  describe("category and train number", () => {
    async function scrapeOne(overrides: Partial<Entry>) {
      fetchMock.on("transport.opendata.ch", jsonResponse({ stationboard: [entry(overrides)] }));
      return (await scrapeSwissTrains("CH06013")).trains[0]!;
    }

    it("keeps a line number that is not part of the train name", async () => {
      const train = await scrapeOne({ category: "S", number: "3", name: "S3 23456" });

      expect(train).toMatchObject({ category: "S3", trainNumber: "S3 23456" });
    });

    it("does not repeat the line number when it equals the number in the name", async () => {
      const train = await scrapeOne({ category: "S", number: "11", name: "S11" });

      expect(train).toMatchObject({ category: "S", trainNumber: "S11" });
    });

    it("compares line and name numbers ignoring spaces and leading zeros", async () => {
      const train = await scrapeOne({ category: "IC", number: "008", name: "IC 008" });

      expect(train).toMatchObject({ category: "IC", trainNumber: "IC 008" });
    });

    it("strips leading zeros from numeric names", async () => {
      const train = await scrapeOne({ category: "", number: "0", name: "000123" });

      expect(train).toMatchObject({ category: null, trainNumber: "123" });
    });

    it("falls back to empty strings when name and number are missing", async () => {
      const train = await scrapeOne({ category: "R", number: null, name: null });

      expect(train).toMatchObject({ category: "R", trainNumber: "" });
    });

    it("uses the first segment of the operator as brand, or null", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({
          stationboard: [entry({ operator: "SOB-sob" }), entry({ operator: "" })],
        }),
      );

      const { trains } = await scrapeSwissTrains("CH06013");

      expect(trains.map((train) => train.brand)).toEqual(["SOB", null]);
    });
  });

  describe("delay and platform", () => {
    it("reports only positive delays", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({
          stationboard: [
            entry({ stop: stop({ delay: 5 }) }),
            entry({ stop: stop({ delay: 0 }) }),
            entry({ stop: stop({ delay: null }) }),
            entry({ stop: stop({ delay: -1 }) }),
          ],
        }),
      );

      const { trains } = await scrapeSwissTrains("CH06013");

      expect(trains.map((train) => train.delay)).toEqual([5, null, null, null]);
    });

    it("prefers the prognosis platform, then the scheduled one, then null", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({
          stationboard: [
            entry({ stop: stop({ platform: "7", prognosis: { platform: "9" } }) }),
            entry({ stop: stop({ platform: "7", prognosis: { platform: null } }) }),
            entry({ stop: stop({ platform: null, prognosis: { platform: null } }) }),
            entry({
              stop: {
                ...stop({ platform: "4" }),
                prognosis: undefined as unknown as Stop["prognosis"],
              },
            }),
          ],
        }),
      );

      const { trains } = await scrapeSwissTrains("CH06013");

      expect(trains.map((train) => train.platform)).toEqual(["9", "7", null, "4"]);
    });
  });

  describe("status", () => {
    it("marks departures within 3 minutes of the delayed time as departing", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({
          stationboard: [
            entry({ stop: stop({ departure: minutesFromNow(2) }) }),
            entry({ stop: stop({ departure: minutesFromNow(3) }) }),
            entry({ stop: stop({ departure: minutesFromNow(4) }) }),
            entry({ stop: stop({ departure: minutesFromNow(-3) }) }),
            entry({ stop: stop({ departure: minutesFromNow(-4) }) }),
            // Scheduled 10 minutes ago but 8 minutes late: now 2 minutes away.
            entry({ stop: stop({ departure: minutesFromNow(-10), delay: 8 }) }),
            // Scheduled in 2 minutes but 10 minutes late: now outside the window.
            entry({ stop: stop({ departure: minutesFromNow(2), delay: 10 }) }),
          ],
        }),
      );

      const { trains } = await scrapeSwissTrains("CH06013", "departures");

      expect(trains.map((train) => train.status)).toEqual([
        "departing",
        "departing",
        null,
        "departing",
        null,
        "departing",
        null,
      ]);
    });

    it("marks arrivals within the window as incoming", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({
          stationboard: [
            entry({ stop: stop({ departure: minutesFromNow(1) }) }),
            entry({ stop: stop({ departure: minutesFromNow(30) }) }),
          ],
        }),
      );

      const { trains } = await scrapeSwissTrains("CH06013", "arrivals");

      expect(trains.map((train) => train.status)).toEqual(["incoming", null]);
    });

    it("has no status when neither time is known", async () => {
      fetchMock.on(
        "transport.opendata.ch",
        jsonResponse({ stationboard: [entry({ stop: stop({ departure: null, arrival: null }) })] }),
      );

      const [train] = (await scrapeSwissTrains("CH06013")).trains;

      expect(train?.status).toBeNull();
      expect(train?.scheduledTime).toBe("--:--");
    });
  });

  it("returns an empty board for an empty stationboard", async () => {
    fetchMock.on("transport.opendata.ch", jsonResponse({ stationboard: [] }));

    await expect(scrapeSwissTrains("CH06013")).resolves.toMatchObject({ trains: [], info: null });
  });

  it("keeps the order sent by the upstream", async () => {
    fetchMock.on(
      "transport.opendata.ch",
      jsonResponse({
        stationboard: [
          entry({ name: "IC 2", number: "2", stop: stop({ departure: minutesFromNow(30) }) }),
          entry({ name: "IC 1", number: "1", stop: stop({ departure: minutesFromNow(10) }) }),
        ],
      }),
    );

    const { trains } = await scrapeSwissTrains("CH06013");

    expect(trains.map((train) => train.trainNumber)).toEqual(["IC 2", "IC 1"]);
  });

  it.each([{}, { stationboard: null }, { stationboard: "nope" }])(
    "throws when the response has no stationboard array (%j)",
    async (body) => {
      fetchMock.on("transport.opendata.ch", jsonResponse(body));

      await expect(scrapeSwissTrains("CH06013")).rejects.toThrow(
        "Invalid response from Swiss train data source.",
      );
    },
  );

  it("wraps upstream HTTP errors in a ScraperError", async () => {
    fetchMock.on("transport.opendata.ch", jsonResponse({ error: "down" }, { status: 502 }));

    const error = await scrapeSwissTrains("CH06013").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("Swiss"),
      upstream: { host: "transport.opendata.ch", status: 502 },
    });
  });

  it("reports an unreadable body as a bad gateway", async () => {
    fetchMock.on("transport.opendata.ch", textResponse("<html>oops</html>"));

    const error = await scrapeSwissTrains("CH06013").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Swiss") });
  });
});
