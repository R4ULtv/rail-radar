import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fiStationCodes from "../../src/scrapers/codes/fi-codes.json";
import { ScraperError } from "../../src/scrapers/core";
import { scrapeFinlandTrains } from "../../src/scrapers/finland";
import { freezeTime, jsonResponse, minutesFromNow, mockFetch, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 11:00 in Helsinki (EET, UTC+2)

type Row = {
  stationShortCode: string;
  stationUICCode: number;
  type: "ARRIVAL" | "DEPARTURE";
  trainStopping: boolean;
  commercialStop?: boolean;
  cancelled: boolean;
  scheduledTime: string;
  liveEstimateTime?: string;
  actualTime?: string;
  differenceInMinutes: number;
  commercialTrack?: string;
};

type Entry = {
  trainNumber: number;
  trainType: string;
  trainCategory: string;
  commuterLineID: string;
  operatorShortCode: string;
  runningCurrently: boolean;
  cancelled: boolean;
  timeTableRows: Row[];
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    stationShortCode: "HKI",
    stationUICCode: 1,
    type: "DEPARTURE",
    trainStopping: true,
    commercialStop: true,
    cancelled: false,
    scheduledTime: minutesFromNow(20),
    differenceInMinutes: 0,
    commercialTrack: "7",
    ...overrides,
  };
}

/** A Helsinki -> Tampere service whose Helsinki rows are customised via the overrides. */
function entry(overrides: Partial<Entry> = {}, hkiDeparture: Partial<Row> = {}): Entry {
  return {
    trainNumber: 27,
    trainType: "IC",
    trainCategory: "Long-distance",
    commuterLineID: "",
    operatorShortCode: "vr",
    runningCurrently: false,
    cancelled: false,
    timeTableRows: [
      row({ type: "DEPARTURE", stationShortCode: "HKI", ...hkiDeparture }),
      row({
        type: "ARRIVAL",
        stationShortCode: "TPE",
        scheduledTime: minutesFromNow(120),
        commercialTrack: "2",
      }),
      row({
        type: "DEPARTURE",
        stationShortCode: "TPE",
        scheduledTime: minutesFromNow(125),
        commercialTrack: "2",
      }),
      row({
        type: "ARRIVAL",
        stationShortCode: "TKU",
        scheduledTime: minutesFromNow(200),
        commercialTrack: "1",
      }),
      // Technical stops are never used for origin or destination.
      row({
        type: "ARRIVAL",
        stationShortCode: "XXX",
        scheduledTime: minutesFromNow(210),
        commercialStop: undefined,
      }),
    ],
    ...overrides,
  };
}

/** A service that terminates in Helsinki, coming from Turku via Tampere. */
function inbound(overrides: Partial<Entry> = {}, hkiArrival: Partial<Row> = {}): Entry {
  return {
    ...entry(),
    timeTableRows: [
      row({ type: "DEPARTURE", stationShortCode: "TKU", scheduledTime: minutesFromNow(-100) }),
      row({ type: "ARRIVAL", stationShortCode: "TPE", scheduledTime: minutesFromNow(-50) }),
      row({ type: "DEPARTURE", stationShortCode: "TPE", scheduledTime: minutesFromNow(-45) }),
      row({ type: "ARRIVAL", stationShortCode: "HKI", ...hkiArrival }),
    ],
    ...overrides,
  };
}

describe("scrapeFinlandTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("requests departures using the short code mapped from the padded station id", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse([]));

      await scrapeFinlandTrains("FI001", "departures");

      expect((fiStationCodes as { [id: string]: string })["001"]).toBe("HKI");
      expect(fetchMock.requests).toHaveLength(1);
      expect(fetchMock.requests[0]?.url).toBe(
        "https://rata.digitraffic.fi/api/v1/live-trains/station/HKI?departing_trains=16&arriving_trains=0&arrived_trains=0&departed_trains=0",
      );
      expect(fetchMock.requests[0]?.headers.get("Accept-Encoding")).toBe("gzip");
    });

    it("requests arriving trains for arrivals", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse([]));

      await scrapeFinlandTrains("FI160", "arrivals");

      expect(fetchMock.requests[0]?.url).toBe(
        "https://rata.digitraffic.fi/api/v1/live-trains/station/TPE?arriving_trains=16&departing_trains=0&arrived_trains=0&departed_trains=0",
      );
    });

    it("defaults to departures", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse([]));

      await scrapeFinlandTrains("FI001");

      expect(fetchMock.url().searchParams.get("departing_trains")).toBe("16");
    });

    it("rejects unknown stations without calling the upstream", async () => {
      const error = await scrapeFinlandTrains("FI99999").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 404, message: "Unknown Finnish station." });
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train, naming the destination from the last commercial arrival", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry(
            {},
            {
              scheduledTime: "2026-03-10T09:20:00.000Z",
              differenceInMinutes: 3,
              commercialTrack: "7",
            },
          ),
        ]),
      );

      const result = await scrapeFinlandTrains("FI001", "departures");

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "VR",
          category: "IC",
          trainNumber: "27",
          destination: "Turku",
          scheduledTime: "11:20",
          delay: 3,
          platform: "7",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival to a train, naming the origin from the first commercial departure", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          inbound(
            { trainNumber: 940 },
            { scheduledTime: "2026-03-10T09:05:00.000Z", commercialTrack: "9" },
          ),
        ]),
      );

      const result = await scrapeFinlandTrains("FI001", "arrivals");

      expect(result.trains).toEqual([
        {
          brand: "VR",
          category: "IC",
          trainNumber: "940",
          origin: "Turku",
          scheduledTime: "11:05",
          delay: 0,
          platform: "9",
          status: "incoming",
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("formats times in Helsinki summer time", async () => {
      freezeTime("2026-07-10T09:00:00.000Z");
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([entry({}, { scheduledTime: "2026-07-10T09:20:00.000Z" })]),
      );

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.scheduledTime).toBe("12:20");
    });

    it("appends the commuter line to the train type", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainType: "HL", commuterLineID: "P", trainNumber: 1 }),
          entry({ trainType: "HL", commuterLineID: "", trainNumber: 2 }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => train.category)).toEqual(["HLP", "HL"]);
    });

    it("upper-cases the operator code", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse([entry({ operatorShortCode: "vr-track" })]));

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.brand).toBe("VR-TRACK");
    });

    it("falls back to the short code for stations without a known name", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          {
            ...entry(),
            timeTableRows: [
              row({ type: "DEPARTURE" }),
              row({ type: "ARRIVAL", stationShortCode: "QQQ" }),
            ],
          },
        ]),
      );

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.destination).toBe("QQQ");
    });

    it("strips the 'asema' suffix from station names", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          {
            ...entry(),
            timeTableRows: [
              row({ type: "DEPARTURE" }),
              row({ type: "ARRIVAL", stationShortCode: "TPE" }),
            ],
          },
        ]),
      );

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.destination).toBe("Tampere");
    });

    it("uses an empty endpoint when there are no commercial stops", async () => {
      const bare = (type: "DEPARTURE" | "ARRIVAL") => ({
        ...entry(),
        timeTableRows: [row({ type, commercialStop: false })],
      });
      fetchMock.on(
        "rata.digitraffic.fi/api/v1/live-trains/station/HKI?departing",
        jsonResponse([bare("DEPARTURE")]),
      );
      fetchMock.on(
        "rata.digitraffic.fi/api/v1/live-trains/station/HKI?arriving",
        jsonResponse([bare("ARRIVAL")]),
      );

      const departures = await scrapeFinlandTrains("FI001", "departures");
      const arrivals = await scrapeFinlandTrains("FI001", "arrivals");

      expect(departures.trains[0]?.destination).toBe("");
      expect(arrivals.trains[0]?.origin).toBe("");
    });

    it("has no platform when the commercial track is empty or missing", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 1 }, { commercialTrack: "" }),
          entry({ trainNumber: 2 }, { commercialTrack: undefined }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => train.platform)).toEqual([null, null]);
    });
  });

  describe("delay", () => {
    it("clamps negative differences to zero and nulls missing ones", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 1 }, { differenceInMinutes: 7 }),
          entry({ trainNumber: 2 }, { differenceInMinutes: -2 }),
          entry({ trainNumber: 3 }, { differenceInMinutes: undefined }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => train.delay)).toEqual([7, 0, null]);
    });
  });

  describe("status", () => {
    async function statuses(type: "arrivals" | "departures", ...rows: Partial<Row>[]) {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse(
          rows.map((overrides, index) =>
            type === "departures"
              ? entry({ trainNumber: index + 1 }, overrides)
              : inbound({ trainNumber: index + 1 }, overrides),
          ),
        ),
      );
      const { trains } = await scrapeFinlandTrains("FI001", type);
      // The board is sorted by time; report statuses in input order instead.
      return trains
        .toSorted((a, b) => Number(a.trainNumber) - Number(b.trainNumber))
        .map((train) => train.status);
    }

    it("applies the 5-minute window to the best available time", async () => {
      expect(
        await statuses(
          "departures",
          { scheduledTime: minutesFromNow(5) },
          { scheduledTime: minutesFromNow(6) },
          { scheduledTime: minutesFromNow(-5) },
          // Scheduled an hour ago, now expected in 2 minutes.
          { scheduledTime: minutesFromNow(-60), liveEstimateTime: minutesFromNow(2) },
          // Scheduled soon but estimated far later.
          { scheduledTime: minutesFromNow(1), liveEstimateTime: minutesFromNow(40) },
          // Actual time is used when there is no live estimate.
          { scheduledTime: minutesFromNow(-60), actualTime: minutesFromNow(-1) },
          // Live estimate wins over the actual time.
          {
            scheduledTime: minutesFromNow(1),
            actualTime: minutesFromNow(1),
            liveEstimateTime: minutesFromNow(30),
          },
        ),
      ).toEqual(["departing", null, "departing", "departing", null, "departing", null]);
    });

    it("is incoming for arrivals inside the window", async () => {
      expect(
        await statuses(
          "arrivals",
          { scheduledTime: minutesFromNow(4) },
          { scheduledTime: minutesFromNow(30) },
        ),
      ).toEqual(["incoming", null]);
    });

    it("is cancelled when the whole train is cancelled", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([entry({ cancelled: true }, { scheduledTime: minutesFromNow(1) })]),
      );

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.status).toBe("cancelled");
    });

    it("is cancelled when only the stop at this station is cancelled", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ cancelled: false }, { cancelled: true, scheduledTime: minutesFromNow(30) }),
        ]),
      );

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.status).toBe("cancelled");
    });

    it("ignores cancellations at other stations", async () => {
      const base = entry();
      base.timeTableRows[1]!.cancelled = true;
      fetchMock.on("rata.digitraffic.fi", jsonResponse([base]));

      const [train] = (await scrapeFinlandTrains("FI001")).trains;

      expect(train?.status).toBeNull();
    });

    it("keeps cancellations for 10 minutes after their scheduled time", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 1, cancelled: true }, { scheduledTime: minutesFromNow(-10) }),
          entry({ trainNumber: 2, cancelled: true }, { scheduledTime: minutesFromNow(-11) }),
          entry({ trainNumber: 3 }, { cancelled: true, scheduledTime: minutesFromNow(-11) }),
          entry({ trainNumber: 4 }, { cancelled: true, scheduledTime: minutesFromNow(-3) }),
          // Departed trains that are not cancelled are not filtered by age.
          entry({ trainNumber: 5 }, { scheduledTime: minutesFromNow(-45) }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["5", null],
        ["1", "cancelled"],
        ["4", "cancelled"],
      ]);
    });
  });

  describe("board assembly", () => {
    it("excludes on-track machines", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 1, trainCategory: "On-track machines", trainType: "TYO" }),
          entry({ trainNumber: 2, trainCategory: "Commuter" }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("drops trains that have no row of the requested type at the station", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          // Departs Helsinki but never arrives there.
          entry({ trainNumber: 1 }),
          // Arrives in Helsinki and never departs from there.
          inbound({ trainNumber: 2 }),
          // Runs between other stations only.
          {
            ...entry({ trainNumber: 3 }),
            timeTableRows: [
              row({ type: "DEPARTURE", stationShortCode: "TPE" }),
              row({ type: "ARRIVAL", stationShortCode: "TKU" }),
            ],
          },
        ]),
      );

      const departures = await scrapeFinlandTrains("FI001", "departures");
      const arrivals = await scrapeFinlandTrains("FI001", "arrivals");

      expect(departures.trains.map((train) => train.trainNumber)).toEqual(["1"]);
      expect(arrivals.trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("sorts chronologically by the scheduled time at the station", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 3 }, { scheduledTime: "2026-03-10T10:30:00.000Z" }),
          entry({ trainNumber: 1 }, { scheduledTime: "2026-03-10T09:10:00.000Z" }),
          entry({ trainNumber: 2 }, { scheduledTime: "2026-03-10T09:40:00.000Z" }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains.map((train) => train.trainNumber)).toEqual(["1", "2", "3"]);
    });

    it("keeps only the earliest row for a duplicated train number", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse([
          entry({ trainNumber: 9 }, { scheduledTime: "2026-03-10T10:00:00.000Z" }),
          entry({ trainNumber: 9 }, { scheduledTime: "2026-03-10T09:30:00.000Z" }),
        ]),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains).toHaveLength(1);
      expect(trains[0]?.scheduledTime).toBe("11:30");
    });

    it("does not cap the number of trains returned", async () => {
      fetchMock.on(
        "rata.digitraffic.fi",
        jsonResponse(Array.from({ length: 20 }, (_, index) => entry({ trainNumber: index + 1 }))),
      );

      const { trains } = await scrapeFinlandTrains("FI001");

      expect(trains).toHaveLength(20);
    });

    it("returns an empty board for an empty list", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse([]));

      await expect(scrapeFinlandTrains("FI001")).resolves.toMatchObject({ trains: [], info: null });
    });
  });

  describe("errors", () => {
    it.each([{}, null, "nope"])("throws when the response is not an array (%j)", async (body) => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse(body));

      await expect(scrapeFinlandTrains("FI001")).rejects.toThrow(
        "Invalid response from Finnish train data source.",
      );
    });

    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("rata.digitraffic.fi", jsonResponse({}, { status: 500 }));

      const error = await scrapeFinlandTrains("FI001").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 500,
        message: expect.stringContaining("Finnish"),
        upstream: { host: "rata.digitraffic.fi", status: 500 },
      });
    });

    it("wraps network failures in a ScraperError", async () => {
      fetchMock.fail();

      await expect(scrapeFinlandTrains("FI001")).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("Finnish"),
      });
    });
  });
});
