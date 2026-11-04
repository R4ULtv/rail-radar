import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeHungaryTrains } from "../../src/scrapers/hungary";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Budapest (CET)
// Unix time of 2026-03-10 00:00 Budapest, which OTP reports as the service day.
const SERVICE_DAY = Date.parse("2026-03-09T23:00:00Z") / 1000;
const STATION = "HU5510017"; // Budapest-Keleti, importance 1

/** Seconds after local midnight for "HH:MM". */
function at(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 3600 + minutes! * 60;
}

type Stoptime = Record<string, any>;

type StoptimeOptions = {
  departure?: string;
  arrival?: string;
  realtimeDeparture?: string;
  realtimeArrival?: string;
  number?: string;
  shortName?: string | null;
  route?: string | null;
  agency?: string | null;
  headsign?: string | null;
  origin?: string | null;
  platform?: string | null;
  alerts?: unknown[];
  extra?: Stoptime;
};

function stoptime(options: StoptimeOptions = {}): Stoptime {
  const departure = options.departure ?? "10:20";
  const number = options.number ?? "706";
  return {
    scheduledArrival: at(options.arrival ?? departure),
    realtimeArrival: at(options.realtimeArrival ?? options.arrival ?? departure),
    arrivalDelay: 0,
    scheduledDeparture: at(departure),
    realtimeDeparture: at(options.realtimeDeparture ?? departure),
    departureDelay: 0,
    realtime: false,
    realtimeState: "SCHEDULED",
    serviceDay: SERVICE_DAY,
    pickupType: "SCHEDULED",
    dropoffType: "SCHEDULED",
    headsign: options.headsign === undefined ? "Szeged" : options.headsign,
    stop: { platformCode: options.platform === undefined ? "5" : options.platform },
    trip: {
      gtfsId: `1:${number}`,
      tripShortName: options.shortName === undefined ? `${number} gyorsvonat` : options.shortName,
      route: {
        longName: options.route === undefined ? "Ex" : options.route,
        mode: "RAIL",
        agency: options.agency === null ? null : { gtfsId: options.agency ?? "1:198" },
      },
      departureStoptime: {
        stop: { name: options.origin === undefined ? "Budapest-Nyugati" : options.origin },
      },
      alerts: options.alerts ?? [],
    },
    ...options.extra,
  };
}

/** A stoptime with live data: realtime departure at `live` and the matching delay. */
function live(options: StoptimeOptions & { live: string }): Stoptime {
  const delay = at(options.live) - at(options.departure ?? "10:20");
  return stoptime({
    ...options,
    realtimeDeparture: options.live,
    extra: { realtime: true, departureDelay: delay, arrivalDelay: delay, ...options.extra },
  });
}

describe("scrapeHungaryTrains", () => {
  let fetchMock: FetchMock;

  const respond = (stoptimes: Stoptime[] | null) =>
    fetchMock.on(
      "mavplusz.hu",
      jsonResponse({ data: { stop: { stoptimesWithoutPatterns: stoptimes } } }),
    );

  const board = (stoptimes: Stoptime[], type: "arrivals" | "departures" = "departures") => {
    respond(stoptimes);
    return scrapeHungaryTrains(STATION, type);
  };

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request building", () => {
    it("posts a GraphQL query for the converted stop id", async () => {
      await board([]);

      expect(fetchMock.requests).toHaveLength(1);
      const request = fetchMock.requests[0]!;
      const url = fetchMock.url();
      expect(url.origin + url.pathname).toBe(
        "https://mavplusz.hu/otp2-backend/otp/routers/default/index/graphql",
      );
      expect(request.method).toBe("POST");
      expect(request.headers.get("content-type")).toBe("application/json");
      expect(request.headers.get("accept")).toBe("application/json");

      const body = JSON.parse(request.body!);
      expect(body.query).toContain("stoptimesWithoutPatterns");
      expect(body.variables).toEqual({
        id: "1:005510017_0",
        // Five minutes before now, in Unix seconds.
        start: Date.parse(NOW) / 1000 - 300,
        range: 3 * 3600,
        n: 24,
      });
    });

    it("uses the same query for arrivals", async () => {
      await board([], "arrivals");

      expect(JSON.parse(fetchMock.requests[0]!.body!).variables.id).toBe("1:005510017_0");
    });

    it.each([
      ["HU5510017", 3 * 3600], // importance 1
      ["HU4302246", 4 * 3600], // importance 2 (Szombathely)
      ["HU5501131", 8 * 3600], // importance 3 (Tatabánya)
      ["HU4301974", 12 * 3600], // importance 4 (Rajka)
      ["HU9999999", 12 * 3600], // unknown station defaults to the widest range
    ])("scales the time range by station importance (%s)", async (stationId, range) => {
      respond([]);

      await scrapeHungaryTrains(stationId);

      expect(JSON.parse(fetchMock.requests[0]!.body!).variables).toMatchObject({
        id: `1:00${stationId.slice(2)}_0`,
        range,
      });
    });
  });

  describe("response mapping", () => {
    it("maps a departure to a train", async () => {
      const result = await board([
        live({
          departure: "10:20",
          live: "10:25",
          shortName: "706 NAPFÉNY InterCity",
          route: "IC",
          headsign: "Siófok",
          platform: "7",
        }),
      ]);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "MÁV",
          category: "IC",
          trainNumber: "706",
          destination: "Siófok",
          scheduledTime: "10:20",
          delay: 5,
          platform: "7",
          status: null,
          info: null,
        },
      ]);
    });

    it("uses the first stop of the trip as the origin for arrivals", async () => {
      const { trains } = await board(
        [stoptime({ arrival: "10:15", departure: "10:20", origin: "Győr", headsign: "Szeged" })],
        "arrivals",
      );

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ origin: "Győr", scheduledTime: "10:15" });
      expect(trains[0]).not.toHaveProperty("destination", "Szeged");
    });

    it("omits the place when the label is empty", async () => {
      const { trains } = await board([stoptime({ headsign: "<i></i>" })]);

      expect(trains[0]?.destination).toBeUndefined();
    });

    it("formats the scheduled time in Budapest summer time", async () => {
      freezeTime("2026-07-10T09:00:00.000Z"); // 11:00 CEST
      const summerDay = Date.parse("2026-07-09T22:00:00Z") / 1000;

      const { trains } = await board([
        stoptime({ departure: "11:30", extra: { serviceDay: summerDay } }),
      ]);

      expect(trains[0]?.scheduledTime).toBe("11:30");
    });

    it("supports after-midnight offsets of the previous service day", async () => {
      // 34:20 after midnight on 9 March is 10:20 on 10 March.
      const previousDay = Date.parse("2026-03-08T23:00:00Z") / 1000;
      const { trains } = await board([
        stoptime({ extra: { serviceDay: previousDay, scheduledDeparture: 34 * 3600 + 20 * 60 } }),
      ]);

      expect(trains[0]?.scheduledTime).toBe("10:20");
    });

    it("limits the board to 24 trains in chronological order", async () => {
      const stoptimes = Array.from({ length: 30 }, (_, index) =>
        stoptime({
          number: String(1000 + index),
          departure: `${String(23 - Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
        }),
      );

      const { trains } = await board(stoptimes);

      expect(trains).toHaveLength(24);
      const times = trains.map((train) => train.scheduledTime);
      expect(times).toEqual(times.toSorted());
      expect(trains[0]?.scheduledTime).toBe("10:00");
    });

    it("returns an empty board when there are no stoptimes", async () => {
      await expect(board([])).resolves.toMatchObject({ trains: [], info: null });
    });
  });

  describe("filtering", () => {
    it("keeps rail trips only", async () => {
      const bus = stoptime({ number: "1" });
      bus.trip.route.mode = "BUS";
      const noTrip = stoptime({ number: "2" });
      noTrip.trip = null;
      const noRoute = stoptime({ number: "3" });
      noRoute.trip.route = null;

      const { trains } = await board([bus, noTrip, noRoute, stoptime({ number: "4" })]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["4"]);
    });

    it("hides departures that do not pick up passengers", async () => {
      const { trains } = await board([
        stoptime({ number: "1", extra: { pickupType: "NONE" } }),
        stoptime({ number: "2", extra: { pickupType: "CALL_AGENCY" } }),
        stoptime({ number: "3", extra: { pickupType: "COORDINATE_WITH_DRIVER" } }),
        stoptime({ number: "4", extra: { pickupType: null } }),
        stoptime({ number: "5", extra: { dropoffType: "NONE" } }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2", "3", "4", "5"]);
    });

    it("hides arrivals that do not drop passengers off", async () => {
      const { trains } = await board(
        [
          stoptime({ number: "1", extra: { dropoffType: "NONE" } }),
          stoptime({ number: "2", extra: { pickupType: "NONE" } }),
        ],
        "arrivals",
      );

      expect(trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("skips stoptimes without a service day or scheduled time", async () => {
      const { trains } = await board([
        stoptime({ number: "1", extra: { serviceDay: null } }),
        stoptime({ number: "2", extra: { scheduledDeparture: null } }),
        stoptime({ number: "3" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["3"]);
    });

    it("drops trains more than five minutes in the past", async () => {
      const { trains } = await board([
        stoptime({ number: "1", departure: "09:54" }),
        stoptime({ number: "2", departure: "09:55" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("keeps a delayed train that has not left yet", async () => {
      const { trains } = await board([
        live({ number: "1", departure: "09:50", live: "10:02" }),
        live({ number: "2", departure: "09:40", live: "09:50" }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({
        trainNumber: "1",
        scheduledTime: "09:50",
        delay: 12,
        status: "departing",
      });
    });
  });

  describe("status and delay", () => {
    it("marks trains within five minutes of now as departing (arrivals as incoming)", async () => {
      const stoptimes = [
        stoptime({ number: "1", departure: "09:55" }),
        stoptime({ number: "2", departure: "10:05" }),
        stoptime({ number: "3", departure: "10:06" }),
      ];

      const departures = await board(stoptimes);
      expect(departures.trains.map((train) => train.status)).toEqual([
        "departing",
        "departing",
        null,
      ]);

      fetchMock = mockFetch();
      const arrivals = await board(stoptimes, "arrivals");
      expect(arrivals.trains.map((train) => train.status)).toEqual(["incoming", "incoming", null]);
    });

    it("bases status on the realtime time when live data exists", async () => {
      const { trains } = await board([live({ departure: "10:02", live: "10:30" })]);

      expect(trains[0]).toMatchObject({ delay: 28, status: null });
    });

    it("ignores realtime offsets when the stoptime has no live data", async () => {
      const { trains } = await board([
        stoptime({
          departure: "10:02",
          realtimeDeparture: "10:30",
          extra: { realtime: false, departureDelay: 1680 },
        }),
      ]);

      expect(trains[0]).toMatchObject({ delay: null, status: "departing" });
    });

    it("reports a null delay when live data has no delay value", async () => {
      const { trains } = await board([
        stoptime({ extra: { realtime: true, departureDelay: null } }),
      ]);

      expect(trains[0]?.delay).toBeNull();
    });

    it("falls back to the scheduled time when live data lacks a realtime offset", async () => {
      const { trains } = await board([
        stoptime({
          departure: "10:02",
          extra: { realtime: true, realtimeDeparture: null, departureDelay: 120 },
        }),
      ]);

      expect(trains[0]).toMatchObject({ delay: 2, status: "departing" });
    });

    it("rounds the delay to whole minutes", async () => {
      const { trains } = await board([
        stoptime({ extra: { realtime: true, departureDelay: 150 } }),
        stoptime({ number: "2", extra: { realtime: true, departureDelay: 89 } }),
      ]);

      expect(trains.map((train) => train.delay)).toEqual([3, 1]);
    });

    it("reads the arrival delay for arrivals", async () => {
      const { trains } = await board(
        [
          stoptime({
            arrival: "10:15",
            departure: "10:20",
            extra: { realtime: true, arrivalDelay: 240, departureDelay: 600 },
          }),
        ],
        "arrivals",
      );

      expect(trains[0]).toMatchObject({ delay: 4 });
    });

    it("marks canceled trips as cancelled, even in the past, without a delay", async () => {
      const { trains } = await board([
        stoptime({
          departure: "08:00",
          extra: { realtimeState: "CANCELED", realtime: true, departureDelay: 600 },
        }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ status: "cancelled", delay: null });
    });
  });

  describe("labels", () => {
    it("maps known agencies to brands and leaves others unbranded", async () => {
      const agencies = [
        "1:198",
        "1:1164",
        "1:1663",
        "1:134",
        "1:204",
        "1:209",
        "1:197",
        "1:196",
        "1:120",
      ];
      const stoptimes = [
        ...agencies.map((agency, index) =>
          stoptime({ number: String(100 + index), agency, departure: `10:${10 + index}` }),
        ),
        stoptime({ number: "200", agency: "1:9999", departure: "10:30" }),
        stoptime({ number: "201", agency: null, departure: "10:31" }),
      ];

      const { trains } = await board(stoptimes);

      expect(trains.map((train) => train.brand)).toEqual([
        "MÁV",
        "MÁV",
        "MÁV",
        "GYSEV",
        "OBB",
        "PKP Intercity",
        "ČD",
        "CFR Călători",
        "UZ",
        null,
        null,
      ]);
    });

    it("takes the category from the first word of the route name", async () => {
      const { trains } = await board([
        stoptime({ number: "1", route: "IC Intercity", departure: "10:10" }),
        stoptime({ number: "2", route: "rjx", departure: "10:11" }),
        stoptime({ number: "3", route: "Rj", departure: "10:12" }),
        stoptime({ number: "4", route: null, departure: "10:13" }),
        stoptime({ number: "5", route: "  ", departure: "10:14" }),
        stoptime({
          number: "6",
          route: '<span class="MNR2007">&#473;</span> Sz személyvonat',
          departure: "10:15",
        }),
      ]);

      expect(trains.map((train) => train.category)).toEqual(["IC", "RJX", "RJ", null, null, "Sz"]);
    });

    it("parses the train number from the trip short name", async () => {
      const { trains } = await board([
        stoptime({ number: "1", shortName: "706 NAPFÉNY gyorsvonat", departure: "10:10" }),
        stoptime({ number: "2", shortName: "S70", departure: "10:11" }),
        stoptime({ number: "3", shortName: null, departure: "10:12" }),
        stoptime({ number: "4", shortName: "  ", departure: "10:13" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["706", "S70", "3", "4"]);
    });

    it("strips markup and decodes entities in labels", async () => {
      const { trains } = await board([
        stoptime({
          headsign: "Győr&nbsp;&amp;&nbsp;Sopron <b>(&#x151;&#337;)</b>",
          platform: "<b>3</b>",
        }),
      ]);

      expect(trains[0]).toMatchObject({ destination: "Győr & Sopron (őő)", platform: "3" });
    });

    it("nulls missing and empty platforms", async () => {
      const noStop = stoptime({ number: "2", departure: "10:21" });
      noStop.stop = null;

      const { trains } = await board([
        stoptime({ number: "1", platform: null }),
        noStop,
        stoptime({ number: "3", platform: " ", departure: "10:22" }),
      ]);

      expect(trains.map((train) => train.platform)).toEqual([null, null, null]);
    });
  });

  describe("alerts", () => {
    const alert = (overrides: Record<string, unknown>) => ({
      alertHeaderText: null,
      alertDescriptionText: null,
      effectiveEndDate: null,
      ...overrides,
    });

    it("reports active alerts, preferring the description over the header", async () => {
      const future = Date.parse(NOW) / 1000 + 3600;
      const { trains } = await board([
        stoptime({
          alerts: [
            alert({ alertHeaderText: "Header", alertDescriptionText: "Pótlóbusz közlekedik;" }),
            alert({ alertHeaderText: "Only header:", effectiveEndDate: future }),
            alert({ alertDescriptionText: "Pótlóbusz közlekedik" }),
            alert({ alertDescriptionText: "<b>   </b>" }),
          ],
        }),
      ]);

      expect(trains[0]?.info).toBe("Pótlóbusz közlekedik · Only header");
    });

    it("drops expired alerts", async () => {
      const past = Date.parse(NOW) / 1000 - 60;
      const { trains } = await board([
        stoptime({
          alerts: [alert({ alertHeaderText: "Old", effectiveEndDate: past })],
        }),
        stoptime({
          number: "2",
          departure: "10:21",
          extra: { trip: { ...stoptime().trip, alerts: null } },
        }),
      ]);

      expect(trains.map((train) => train.info)).toEqual([null, null]);
    });
  });

  describe("merging", () => {
    it("keeps the most specific product when one train appears under several", async () => {
      const { trains } = await board([
        stoptime({ number: "706", route: "Ex", shortName: "706 NAPFÉNY gyorsvonat" }),
        stoptime({ number: "706", route: "IC", shortName: "706 NAPFÉNY InterCity" }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ trainNumber: "706", category: "IC" });
    });

    it.each([
      ["RJX", "EC"],
      ["EC", "IC"],
      ["IC", "IR"],
      ["IR", "Gy"],
      ["Gy", "S"],
      ["S", "Sz"],
      ["Sz", null],
    ])("ranks %s above %s", async (better, worse) => {
      const { trains } = await board([
        stoptime({ number: "1", route: worse }),
        stoptime({ number: "1", route: better }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]?.category).toBe(better);
    });

    it("ranks suburban numbered lines with plain stopping trains", async () => {
      const { trains } = await board([
        stoptime({ number: "10", route: "S70" }),
        stoptime({ number: "20", route: "Sz" }),
        stoptime({ number: "30", route: "G43" }),
      ]);

      // Equal time: higher rank first. S70 and G43 (rank 1) before Sz (rank 0).
      expect(trains.map((train) => train.category)).toEqual(["S70", "G43", "Sz"]);
    });

    it("keeps different trains at the same minute, most specific first", async () => {
      const { trains } = await board([
        stoptime({ number: "3001", route: "Sz", headsign: "Kelenföld" }),
        stoptime({ number: "706", route: "IC", headsign: "Siófok" }),
        stoptime({ number: "811", route: "Ex", headsign: "Pécs" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["706", "811", "3001"]);
    });

    it("does not merge the same number at different times", async () => {
      const { trains } = await board([
        stoptime({ number: "706", departure: "10:20" }),
        stoptime({ number: "706", departure: "11:20" }),
      ]);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["10:20", "11:20"]);
    });

    it("sorts the merged board by time", async () => {
      const { trains } = await board([
        stoptime({ number: "3", departure: "10:40" }),
        stoptime({ number: "1", departure: "10:10" }),
        stoptime({ number: "2", departure: "10:25" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["1", "2", "3"]);
    });

    it("takes the delay and status from the live row and the first known platform", async () => {
      const { trains } = await board([
        stoptime({ number: "706", route: "IC", platform: null, departure: "10:03" }),
        live({ number: "706", route: "Ex", platform: "9", departure: "10:03", live: "10:30" }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ category: "IC", platform: "9", delay: 27, status: null });
    });

    it("keeps the primary row's live data when it has some", async () => {
      const { trains } = await board([
        live({ number: "706", route: "IC", departure: "10:03", live: "10:04" }),
        live({ number: "706", route: "Ex", departure: "10:03", live: "10:30" }),
      ]);

      expect(trains[0]).toMatchObject({ category: "IC", delay: 1, status: "departing" });
    });

    it("keeps cancelled and running rows of one number separate", async () => {
      const { trains } = await board([
        stoptime({ number: "706", headsign: "Siófok" }),
        stoptime({ number: "706", headsign: "Siófok", extra: { realtimeState: "CANCELED" } }),
      ]);

      expect(trains.map((train) => train.status).sort()).toEqual(["cancelled", null]);
    });

    it("merges rows of one number under the same cancellation state", async () => {
      const cancelled = { realtimeState: "CANCELED" };
      const { trains } = await board([
        stoptime({ number: "706", route: "Ex", extra: cancelled }),
        stoptime({ number: "706", route: "IC", extra: cancelled }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ category: "IC", status: "cancelled", delay: null });
    });

    it("does not add 'Also to' for the same number from the same agency", async () => {
      const { trains } = await board([
        stoptime({ number: "706", route: "IC", headsign: "Hegyeshalom" }),
        stoptime({ number: "706", route: "Ex", headsign: "Wien Hbf" }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]?.info).toBeNull();
    });

    it("merges through-car portions of a named train and lists the other destinations", async () => {
      const { trains } = await board([
        stoptime({
          number: "476",
          shortName: "476 METROPOL EuroNight",
          route: "EN",
          agency: "1:198",
          headsign: "Praha hl.n.",
          origin: "Budapest-Keleti",
          platform: "6",
        }),
        stoptime({
          number: "40476",
          shortName: "40476 METROPOL EuroNight",
          route: "EN",
          agency: "1:204",
          headsign: "Berlin Hbf",
          origin: "Budapest-Keleti",
          platform: null,
        }),
        stoptime({
          number: "10476",
          shortName: "10476 METROPOL EuroNight",
          route: "EN",
          agency: "1:197",
          headsign: "Berlin Hbf",
          origin: "Budapest-Keleti",
          platform: null,
        }),
      ]);

      expect(trains).toEqual([
        {
          brand: "MÁV",
          category: "EN",
          trainNumber: "476",
          destination: "Praha hl.n.",
          scheduledTime: "10:20",
          delay: null,
          platform: "6",
          status: null,
          info: "Also to Berlin Hbf",
        },
      ]);
    });

    it("lists the other origins for arrivals", async () => {
      const { trains } = await board(
        [
          stoptime({
            number: "476",
            shortName: "476 METROPOL EuroNight",
            route: "EN",
            origin: "Praha hl.n.",
          }),
          stoptime({
            number: "40476",
            shortName: "40476 METROPOL EuroNight",
            route: "EN",
            agency: "1:204",
            origin: "Berlin Hbf",
          }),
          stoptime({
            number: "10476",
            shortName: "10476 METROPOL EuroNight",
            route: "EN",
            agency: "1:204",
            // Same origin as 476, so the named train is one service.
            origin: "Praha hl.n.",
          }),
        ],
        "arrivals",
      );

      // All three share the name; 40476 joins the others through the common destination.
      // The merged board lists the origins of the portions that differ.
      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({
        trainNumber: "476",
        origin: "Praha hl.n.",
        info: "Also from Berlin Hbf",
      });
    });

    it("prefers the main train over prefixed portions and home agencies over foreign ones", async () => {
      const { trains } = await board([
        stoptime({
          number: "40347",
          shortName: "40347 DACIA gyorsvonat",
          route: "Ex",
          agency: "1:196",
          headsign: "Bucuresti Nord",
        }),
        stoptime({
          number: "10347",
          shortName: "10347 DACIA gyorsvonat",
          route: "Ex",
          agency: "1:198",
          headsign: "Bucuresti Nord",
        }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ trainNumber: "10347", brand: "MÁV" });
    });

    it("keeps named trains with a different origin and destination separate", async () => {
      const { trains } = await board([
        stoptime({
          number: "100",
          shortName: "100 DACIA gyorsvonat",
          headsign: "Brasov",
          origin: "Budapest-Keleti",
        }),
        stoptime({
          number: "200",
          shortName: "200 DACIA gyorsvonat",
          headsign: "Budapest-Keleti",
          origin: "Brasov",
        }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["100", "200"]);
    });

    it("does not merge different numbers that share only an origin", async () => {
      const { trains } = await board([
        stoptime({ number: "100", shortName: "100 DACIA gyorsvonat", headsign: "Brasov" }),
        stoptime({ number: "200", shortName: "200 RUTHENIA gyorsvonat", headsign: "Kyiv" }),
      ]);

      expect(trains).toHaveLength(2);
    });

    it("bridges separate services connected by a joined-train row", async () => {
      const { trains } = await board([
        stoptime({
          number: "100",
          shortName: "100 DACIA gyorsvonat",
          route: "EN",
          origin: "Budapest-Keleti",
          headsign: "Brasov",
        }),
        stoptime({
          number: "200",
          shortName: "200 RUTHENIA gyorsvonat",
          route: "EN",
          origin: "Kyiv",
          headsign: "Bucuresti",
        }),
        stoptime({
          number: "300",
          shortName: "300 DACIA - RUTHENIA gyorsvonat",
          route: "EN",
          origin: "Budapest-Keleti",
          headsign: "Bucuresti",
        }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({
        trainNumber: "100",
        destination: "Brasov",
        info: "Also to Bucuresti",
      });
    });

    it("splits slash-separated names", async () => {
      const { trains } = await board([
        stoptime({
          number: "100",
          shortName: "100 DACIA/RUTHENIA gyorsvonat",
          headsign: "Brasov",
        }),
        stoptime({
          number: "200",
          shortName: "200 RUTHENIA gyorsvonat",
          headsign: "Brasov",
        }),
      ]);

      expect(trains).toHaveLength(1);
      expect(trains[0]?.trainNumber).toBe("100");
    });

    it("combines alerts from all merged rows ahead of the 'Also to' note", async () => {
      const alert = (text: string) => ({
        alertHeaderText: null,
        alertDescriptionText: text,
        effectiveEndDate: null,
      });
      const { trains } = await board([
        stoptime({
          number: "476",
          shortName: "476 METROPOL EuroNight",
          route: "EN",
          headsign: "Praha hl.n.",
          alerts: [alert("Delay expected"), alert("Seat reservation")],
        }),
        stoptime({
          number: "40476",
          shortName: "40476 METROPOL EuroNight",
          route: "EN",
          agency: "1:204",
          headsign: "Berlin Hbf",
          alerts: [alert("Seat reservation"), alert("Restaurant car missing")],
        }),
      ]);

      expect(trains[0]?.info).toBe(
        "Delay expected · Seat reservation · Restaurant car missing · Also to Berlin Hbf",
      );
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("mavplusz.hu", textResponse("down", { status: 500 }));

      const error = await scrapeHungaryTrains(STATION).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 500,
        message: expect.stringContaining("Hungarian"),
        upstream: { host: "mavplusz.hu", status: 500 },
      });
    });

    it("reports the per-IP burst limit (403) as a temporary 503", async () => {
      fetchMock.on("mavplusz.hu", textResponse("host limit achived", { status: 403 }));

      const error = await scrapeHungaryTrains(STATION).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("temporarily limiting"),
        upstream: { host: "mavplusz.hu", status: 403 },
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
      fetchMock.on("mavplusz.hu", textResponse("<html>gateway</html>"));

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("invalid response"),
      });
    });

    it("surfaces GraphQL errors returned with HTTP 200", async () => {
      fetchMock.on(
        "mavplusz.hu",
        jsonResponse({ errors: [{ message: "Validation error" }, { message: "Other" }] }),
      );

      const error = await scrapeHungaryTrains(STATION).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 502,
        message: "The Hungarian train data source returned an error. Please try again.",
        timing: { fetchMs: expect.any(Number) },
      });
      expect((error as ScraperError).cause).toEqual(new Error("Validation error; Other"));
    });

    it("returns 404 for an unknown stop", async () => {
      fetchMock.on("mavplusz.hu", jsonResponse({ data: { stop: null } }));

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining("does not know this station"),
      });
    });

    it.each([
      ["no data", {}],
      ["null data", { data: null }],
      ["missing stoptimes", { data: { stop: {} } }],
      ["null stoptimes", { data: { stop: { stoptimesWithoutPatterns: null } } }],
      ["non-array stoptimes", { data: { stop: { stoptimesWithoutPatterns: {} } } }],
    ])("rejects an invalid response shape (%s)", async (_label, payload) => {
      fetchMock.on("mavplusz.hu", jsonResponse(payload));

      await expect(scrapeHungaryTrains(STATION)).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining("invalid response"),
      });
    });
  });
});
