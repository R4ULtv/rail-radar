import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeHungaryTrains } from "../../src/scrapers/hungary";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Budapest (CET)
const STATION = "HU5510017"; // Budapest-Keleti
const HOST = "jegy-a.mav.hu";
const ROW_LIMIT = 80;

/** "HH:MM" on the frozen day in Budapest winter time. */
function at(time: string, date = "2026-03-10"): string {
  return `${date}T${time}:00+01:00`;
}

type Row = Record<string, any>;

type RowOptions = {
  number?: string;
  departure?: string | null;
  arrival?: string | null;
  liveDeparture?: string;
  liveArrival?: string;
  date?: string;
  kind?: string;
  line?: string;
  from?: string;
  fromCode?: string;
  to?: string;
  toCode?: string;
  startTrack?: string | null;
  endTrack?: string | null;
  notices?: string[] | null;
  delayReason?: string | null;
};

function row(options: RowOptions = {}): Row {
  const date = options.date ?? "2026-03-10";
  const time = (value: string | null | undefined) => (value ? at(value, date) : null);
  const departure = options.departure === undefined ? "10:20" : options.departure;
  return {
    code: options.number ?? "706",
    start: time(departure),
    arrive: time(options.arrival),
    actualOrEstimatedStart: time(options.liveDeparture),
    actualOrEstimatedArrive: time(options.liveArrival),
    startTrack: options.startTrack === undefined ? "5" : options.startTrack,
    endTrack: options.endTrack === undefined ? null : options.endTrack,
    startStation: {
      name: options.from ?? "Budapest-Keleti",
      code: options.fromCode ?? "005510017",
    },
    endStation: { name: options.to ?? "Szeged", code: options.toCode ?? "005517228" },
    kind: { name: options.kind ?? "InterCity" },
    viszonylatiJel: options.line ? { jel: options.line } : null,
    havarianInfok: {
      aktualisKeses: 0,
      havariaInfo: options.notices ?? null,
      kesesiOk: options.delayReason ?? null,
      kesesInfo: "",
    },
  };
}

/** An arriving train: listed by arrival time, with its platform in endTrack. */
function arrival(options: RowOptions & { arrival: string }): Row {
  return row({ departure: null, startTrack: null, endTrack: "5", from: "Szeged", ...options });
}

function payload(departures: Row[], arrivals: Row[] = []) {
  return {
    stationSchedulerDetails: { departureScheduler: departures, arrivalScheduler: arrivals },
  };
}

/** Pads a board to the row limit so it reads as cut off, not as the end of the day. */
function fullBoard(departures: Row[]) {
  const filler = Array.from({ length: ROW_LIMIT - departures.length }, (_, index) =>
    arrival({ number: `9${index}`, arrival: "23:00" }),
  );
  return payload(departures, filler);
}

describe("scrapeHungaryTrains", () => {
  let fetchMock: FetchMock;

  // A short board reads as the end of the day, so an empty next day follows it.
  const board = (departures: Row[], arrivals: Row[] = [], type?: "arrivals" | "departures") => {
    fetchMock
      .once(HOST, jsonResponse(payload(departures, arrivals)))
      .once(HOST, jsonResponse(payload([])));
    return scrapeHungaryTrains(STATION, type);
  };
  const departures = (rows: Row[]) => board(rows);
  const arrivals = (rows: Row[]) => board([], rows, "arrivals");
  const requestBody = (n = 0) => JSON.parse(fetchMock.requests[n]!.body!);

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("asks for the station board from half an hour ago", async () => {
      fetchMock.on(HOST, jsonResponse(fullBoard([])));

      await scrapeHungaryTrains(STATION);

      expect(fetchMock.requests).toHaveLength(1);
      const request = fetchMock.requests[0]!;
      expect(request.url).toBe("https://jegy-a.mav.hu/IK_API_PROD/api/InformationApi/GetTimetable");
      expect(request.method).toBe("POST");
      expect(request.headers.get("Content-Type")).toBe("application/json");
      expect(request.headers.get("Language")).toBe("hu");
      expect(requestBody()).toEqual({
        type: "StationInfo",
        travelDate: "2026-03-10T08:30:00.000Z",
        stationNumberCode: "005510017",
        minCount: "0",
        maxCount: "80",
      });
    });

    it("converts GYSEV station IDs too", async () => {
      fetchMock.on(HOST, jsonResponse(fullBoard([])));

      await scrapeHungaryTrains("HU4302725", "arrivals");

      expect(requestBody().stationNumberCode).toBe("004302725");
    });
  });

  describe("response mapping", () => {
    it("maps a departure to a train", async () => {
      const result = await departures([row()]);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toEqual(expect.any(Number));
      expect(result.trains).toEqual([
        {
          brand: "MÁV",
          category: "IC",
          trainNumber: "706",
          destination: "Szeged",
          scheduledTime: "10:20",
          delay: null,
          platform: "5",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival from the arrival list, with its origin and arrival platform", async () => {
      const result = await board(
        [row({ number: "1" })],
        [arrival({ number: "2", arrival: "10:15", liveArrival: "10:18" })],
        "arrivals",
      );

      expect(result.trains).toEqual([
        {
          brand: "MÁV",
          category: "IC",
          trainNumber: "2",
          origin: "Szeged",
          scheduledTime: "10:15",
          delay: 3,
          platform: "5",
          status: null,
          info: null,
        },
      ]);
    });

    it("lists a through train by its arrival or departure time", async () => {
      const through = { arrival: "10:20", departure: "10:25", endTrack: "4", startTrack: "4" };

      expect((await board([row(through)], [row(through)])).trains[0]).toMatchObject({
        scheduledTime: "10:25",
      });
      expect((await board([row(through)], [row(through)], "arrivals")).trains[0]).toMatchObject({
        scheduledTime: "10:20",
        platform: "4",
      });
    });

    it("formats the scheduled time in Budapest summer time", async () => {
      freezeTime("2026-07-10T08:00:00.000Z");
      const result = await departures([
        { ...row(), start: "2026-07-10T08:20:00.000Z" }, // 10:20 CEST
      ]);

      expect(result.trains[0]?.scheduledTime).toBe("10:20");
    });

    it("limits the board to 24 trains in scheduled order", async () => {
      const rows = Array.from({ length: 30 }, (_, index) =>
        row({
          number: String(index),
          departure: `${String(10 + Math.floor(index / 6))}:${String((index % 6) * 10).padStart(2, "0")}`,
        }),
      ).reverse();

      const result = await departures(rows);

      expect(result.trains).toHaveLength(24);
      expect(result.trains.map((train) => train.trainNumber)).toEqual(
        Array.from({ length: 24 }, (_, index) => String(index)),
      );
    });

    it("returns an empty board when nothing runs", async () => {
      fetchMock.on(HOST, jsonResponse(fullBoard([])));
      expect((await scrapeHungaryTrains(STATION)).trains).toEqual([]);
    });
  });

  describe("filtering", () => {
    it("skips rail replacement buses", async () => {
      const result = await departures([
        row({ number: "1", kind: "vonatpótló autóbusz" }),
        row({ number: "2" }),
      ]);

      expect(result.trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("skips rows without a time for the requested direction", async () => {
      const result = await departures([
        row({ number: "1", departure: null }),
        row({ number: "2" }),
      ]);

      expect(result.trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("drops trains that left more than five minutes ago", async () => {
      const result = await departures([
        row({ number: "1", departure: "09:50" }),
        row({ number: "2", departure: "09:56" }),
      ]);

      expect(result.trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("keeps a delayed train that has not left yet", async () => {
      const result = await departures([row({ departure: "09:40", liveDeparture: "10:02" })]);

      expect(result.trains[0]).toMatchObject({ scheduledTime: "09:40", delay: 22 });
    });
  });

  describe("status and delay", () => {
    it("marks trains within five minutes of now as departing (arrivals as incoming)", async () => {
      const rows = [
        row({ number: "1", departure: "10:04" }),
        row({ number: "2", departure: "10:06" }),
      ];

      expect((await departures(rows)).trains.map((train) => train.status)).toEqual([
        "departing",
        null,
      ]);
      expect(
        (await arrivals([arrival({ arrival: "09:58" })])).trains.map((train) => train.status),
      ).toEqual(["incoming"]);
    });

    it("bases the delay and status on the live estimate", async () => {
      const result = await departures([row({ departure: "09:50", liveDeparture: "10:03" })]);

      expect(result.trains[0]).toMatchObject({ delay: 13, status: "departing" });
    });

    it("reports an on-time live estimate as no delay", async () => {
      const result = await departures([row({ liveDeparture: "10:20" })]);

      expect(result.trains[0]?.delay).toBe(0);
    });

    it("reads the arrival estimate for arrivals, not the departure one", async () => {
      const result = await arrivals([
        arrival({
          arrival: "10:20",
          liveArrival: "10:29",
          departure: "10:25",
          liveDeparture: "10:30",
        }),
      ]);

      expect(result.trains[0]?.delay).toBe(9);
    });
  });

  describe("labels", () => {
    it("prefers the suburban or regional line code as the category", async () => {
      const result = await departures([
        row({ number: "1", kind: "személyvonat", line: "S70" }),
        row({ number: "2", kind: "InterRégió", line: "IR85" }),
        row({ number: "3", kind: "InterRégió" }),
      ]);

      expect(result.trains.map((train) => train.category)).toEqual(["S70", "IR85", "IR"]);
    });

    it.each([
      ["railjet xpress", "RJX"],
      ["railjet", "RJ"],
      ["EuroNight", "EN"],
      ["EuroCity", "EC"],
      ["InterCity", "IC"],
      ["EuroRegio", "ER"],
      ["Expresszvonat", "Ex"],
      ["gyorsvonat", "Gy"],
      ["sebesvonat", "Sebes"],
      ["személyvonat", "Sz"],
      ["Nosztalgiavonat", "Nosztalgiavonat"],
    ])("maps the %s kind to %s", async (kind, category) => {
      const result = await departures([row({ kind })]);

      expect(result.trains[0]?.category).toBe(category);
    });

    it("brands GYSEV's regional trains by their stations, and everything else MÁV", async () => {
      const result = await departures([
        row({ number: "9933", kind: "személyvonat", fromCode: "004302725", to: "Győr" }),
        row({ number: "9846", kind: "személyvonat", toCode: "004302246" }),
        row({ number: "981", kind: "InterCity", toCode: "004302725" }),
        row({ number: "6636", kind: "személyvonat" }),
      ]);

      expect(result.trains.map((train) => train.brand)).toEqual(["GYSEV", "GYSEV", "MÁV", "MÁV"]);
    });

    it("trims labels and nulls missing platforms", async () => {
      const result = await departures([
        row({ number: " 706 ", to: "  Wien   Hbf ", startTrack: " 4a " }),
        row({ number: "707", startTrack: null }),
        row({ number: "708", startTrack: "" }),
      ]);

      expect(
        result.trains.map((train) => [train.trainNumber, train.destination, train.platform]),
      ).toEqual([
        ["706", "Wien Hbf", "4a"],
        ["707", "Szeged", null],
        ["708", "Szeged", null],
      ]);
    });
  });

  describe("info", () => {
    it("joins the disruption notices without repeats", async () => {
      const result = await departures([
        row({
          notices: [
            "Étkezőkocsi nélkül közlekedik.",
            "Várhatóan 10-15 perces késéssel indul.\t",
            "Étkezőkocsi nélkül közlekedik.",
          ],
        }),
      ]);

      expect(result.trains[0]?.info).toBe(
        "Étkezőkocsi nélkül közlekedik. · Várhatóan 10-15 perces késéssel indul.",
      );
    });

    it("adds the delay reason only when the train is late here", async () => {
      const reason = "Pálya állapota miatti késés";
      const result = await departures([
        row({ number: "1", liveDeparture: "10:31", delayReason: reason }),
        // Late on the way in, but the stop absorbs it.
        row({ number: "2", liveDeparture: "10:20", delayReason: reason }),
        row({ number: "3", delayReason: reason }),
      ]);

      expect(result.trains.map((train) => train.info)).toEqual([reason, null, null]);
    });
  });

  describe("next service day", () => {
    it("carries on with the next day when the board ends early", async () => {
      fetchMock.once(HOST, jsonResponse(payload([row({ number: "1", departure: "23:50" })]))).once(
        HOST,
        jsonResponse(
          payload([
            // Listed on both days' boards.
            row({ number: "1", departure: "23:50" }),
            row({ number: "2", departure: "00:30", date: "2026-03-11" }),
          ]),
        ),
      );

      const result = await scrapeHungaryTrains(STATION);

      expect(requestBody(1).travelDate).toBe("2026-03-11");
      expect(result.trains.map((train) => [train.trainNumber, train.scheduledTime])).toEqual([
        ["1", "23:50"],
        ["2", "00:30"],
      ]);
    });

    it("takes the next day after the board's start, just after midnight", async () => {
      freezeTime("2026-03-09T23:10:00.000Z"); // 00:10 on 10 March in Budapest
      fetchMock.on(HOST, jsonResponse(payload([])));

      await scrapeHungaryTrains(STATION);

      expect(requestBody(0).travelDate).toBe("2026-03-09T22:40:00.000Z");
      expect(requestBody(1).travelDate).toBe("2026-03-10");
    });

    it("adds both fetch times", async () => {
      fetchMock.on(HOST, jsonResponse(payload([])));

      const result = await scrapeHungaryTrains(STATION);

      expect(fetchMock.requests).toHaveLength(2);
      expect(result.timing.fetchMs).toEqual(expect.any(Number));
    });

    it("stops at one request when the board was cut off by the row limit", async () => {
      fetchMock.on(HOST, jsonResponse(fullBoard([row()])));

      await scrapeHungaryTrains(STATION);

      expect(fetchMock.requests).toHaveLength(1);
    });

    it("stops at one request when the board is already full", async () => {
      const rows = Array.from({ length: 24 }, (_, index) => row({ number: String(index) }));
      fetchMock.on(HOST, jsonResponse(payload(rows)));

      await scrapeHungaryTrains(STATION);

      expect(fetchMock.requests).toHaveLength(1);
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on(
        HOST,
        jsonResponse({ message: "Nincs érvényes állomás részlet" }, { status: 500 }),
      );

      const error = await scrapeHungaryTrains(STATION).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 500,
        message: expect.stringContaining("Hungarian"),
        upstream: { host: HOST, status: 500 },
      });
    });

    it("maps network failures to 502", async () => {
      fetchMock.fail();

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("Hungarian"),
      });
    });

    it("rejects invalid JSON with 502", async () => {
      fetchMock.on(HOST, textResponse("<html>gateway</html>"));

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("invalid response"),
      });
    });

    it.each([
      ["null body", null],
      ["no details", {}],
      ["null details", { stationSchedulerDetails: null }],
      ["missing arrivals", { stationSchedulerDetails: { departureScheduler: [] } }],
      [
        "non-array departures",
        { stationSchedulerDetails: { departureScheduler: {}, arrivalScheduler: [] } },
      ],
    ])("rejects an invalid response shape (%s)", async (_label, body) => {
      fetchMock.on(HOST, jsonResponse(body));

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("invalid response"),
        timing: { fetchMs: expect.any(Number) },
      });
    });
  });
});
