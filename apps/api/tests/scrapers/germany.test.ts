import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import {
  formatDbTime,
  getMessageText,
  mergeTimetables,
  parseDbTime,
  parseTimetable,
  scrapeGermanTrains,
} from "../../src/scrapers/germany";
import { captureLogs, freezeTime, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z"; // 10:00 in Berlin (CET)
const ENV = { DB_CLIENT_ID: "client-id", DB_API_KEY: "api-key" };
const STATION = "DE00105"; // EVA 8000105
const BASE = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";

type Attrs = Record<string, string>;

// --- XML builders -----------------------------------------------------------------------------

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function el(name: string, attrs: Attrs = {}, children: string[] = []): string {
  const rendered = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join("");
  return children.length > 0
    ? `<${name}${rendered}>${children.join("")}</${name}>`
    : `<${name}${rendered}/>`;
}

const message = (attrs: Attrs) => el("m", attrs);

type StopOptions = {
  /** Label attributes; `null` omits the label like a change-feed stop without one. */
  tl?: Attrs | null;
  ar?: Attrs;
  dp?: Attrs;
  arMessages?: Attrs[];
  dpMessages?: Attrs[];
  messages?: Attrs[];
};

function stop(id: string, options: StopOptions = {}): string {
  const children: string[] = [];
  if (options.tl !== null) {
    children.push(el("tl", { t: "p", o: "80", c: "ICE", n: "591", ...options.tl }));
  }
  if (options.ar) children.push(el("ar", options.ar, (options.arMessages ?? []).map(message)));
  if (options.dp) children.push(el("dp", options.dp, (options.dpMessages ?? []).map(message)));
  children.push(...(options.messages ?? []).map(message));
  return el("s", { id }, children);
}

/** "10:20" on 10 March 2026 in DB's yyMMddHHmm format. */
const t = (time: string, day = "260310") => `${day}${time.replace(":", "")}`;

/** A departure stop of train `n` scheduled at `time`; the stop id is derived from `n`. */
function dep(n: string, time: string, extra: Attrs = {}, options: StopOptions = {}): string {
  return stop(`${n}-dep`, {
    ...options,
    tl: { n, ...options.tl },
    dp: { pt: t(time), pp: "7", ppth: "Mannheim Hbf|Stuttgart Hbf", ...extra },
  });
}

/** An arrival stop of train `n` scheduled at `time`. */
function arr(n: string, time: string, extra: Attrs = {}, options: StopOptions = {}): string {
  return stop(`${n}-arr`, {
    ...options,
    tl: { n, ...options.tl },
    ar: { pt: t(time), pp: "7", ppth: "Hamburg Hbf|Köln Hbf", ...extra },
  });
}

function timetable(stops: string[] = [], messages: Attrs[] = []): string {
  return el("timetable", { station: "Frankfurt(Main)Hbf", eva: "8000105" }, [
    ...messages.map(message),
    ...stops,
  ]);
}

// --- Fetch routing ----------------------------------------------------------------------------

/** All paths (after the v1 base) requested so far, sorted. */
function requestedPaths(fetchMock: FetchMock): string[] {
  return fetchMock.requests.map((request) => request.url.slice(`${BASE}/`.length)).sort();
}

describe("scrapeGermanTrains", () => {
  let fetchMock: FetchMock;

  /** Serve plans keyed by "yyMMdd/HH" (anything else is an empty plan) and the change feed. */
  function serve(plans: Record<string, string> = {}, changes: string = timetable()) {
    fetchMock.on("/fchg/", () => textResponse(changes));
    fetchMock.on("/plan/", (request) => {
      const slice = new URL(request.url).pathname.split("/plan/")[1]!.split("/").slice(1).join("/");
      return textResponse(plans[slice] ?? timetable());
    });
  }

  const run = (type: "arrivals" | "departures" = "departures", stationId = STATION) =>
    scrapeGermanTrains(stationId, type, ENV);

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("configuration", () => {
    it.each([
      ["no env", undefined],
      ["empty env", {}],
      ["missing key", { DB_CLIENT_ID: "id" }],
      ["missing client id", { DB_API_KEY: "key" }],
      ["empty client id", { DB_CLIENT_ID: "", DB_API_KEY: "key" }],
      ["empty key", { DB_CLIENT_ID: "id", DB_API_KEY: "" }],
      ["non-string values", { DB_CLIENT_ID: 1, DB_API_KEY: 2 }],
    ])("fails with 500 when credentials are missing (%s)", async (_label, env) => {
      const error = await scrapeGermanTrains(STATION, "departures", env).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 500,
        message: "DB Timetables credentials are not configured.",
      });
      expect(fetchMock.requests).toHaveLength(0);
    });

    it.each(["DE123", "DE1234567", "DE0010A", "AT00105", "de00105", "00105", ""])(
      "rejects the station id %j that has no verified EVA with 404",
      async (stationId) => {
        const error = await run("departures", stationId).catch((error: unknown) => error);

        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 404,
          message: "This station has no verified German EVA identifier.",
        });
        expect(fetchMock.requests).toHaveLength(0);
      },
    );
  });

  describe("request building", () => {
    it("requests the plan slices across the lookback and board window plus the change feed", async () => {
      serve();

      await run();

      // Now is 10:00 Berlin: lookback of two hours (08) through the two-hour window (12).
      expect(requestedPaths(fetchMock)).toEqual(
        [
          "fchg/8000105",
          "plan/8000105/260310/08",
          "plan/8000105/260310/09",
          "plan/8000105/260310/10",
          "plan/8000105/260310/11",
          "plan/8000105/260310/12",
        ].sort(),
      );
    });

    it("sends credentials as headers and requests XML", async () => {
      serve();

      await run();

      for (const request of fetchMock.requests) {
        expect(request.method).toBe("GET");
        expect(request.headers.get("DB-Client-ID")).toBe("client-id");
        expect(request.headers.get("DB-Api-Key")).toBe("api-key");
        expect(request.headers.get("Accept")).toBe("application/xml");
        expect(request.url.startsWith(`${BASE}/`)).toBe(true);
        expect(new URL(request.url).search).toBe("");
      }
    });

    it("uses the same requests for arrivals and departures", async () => {
      serve();
      // Without a cache, so the second board is fetched rather than served from the first.
      vi.stubGlobal("caches", undefined);

      await run("departures");
      const departures = requestedPaths(fetchMock);
      fetchMock.requests.length = 0;
      await run("arrivals");

      expect(requestedPaths(fetchMock)).toEqual(departures);
    });

    it("serves the other board direction from the cached responses", async () => {
      serve();

      await run("departures");
      fetchMock.requests.length = 0;
      await run("arrivals");

      expect(fetchMock.requests).toHaveLength(0);
    });

    it("derives the EVA from the station id", async () => {
      serve();

      await run("departures", "DE08005");

      expect(requestedPaths(fetchMock)).toContain("fchg/8008005");
      expect(requestedPaths(fetchMock)).toContain("plan/8008005/260310/10");
    });

    it("scopes Berlin Hbf to its through-platform EVA", async () => {
      serve();

      await run("departures", "DE11160");

      expect(
        requestedPaths(fetchMock).every(
          (path) => path.includes("/8098160") || path === "fchg/8098160",
        ),
      ).toBe(true);
      expect(requestedPaths(fetchMock)).toContain("fchg/8098160");
      expect(requestedPaths(fetchMock)).toHaveLength(6);
    });

    it("keeps the same slices for any time within the hour", async () => {
      freezeTime("2026-03-10T09:59:59.000Z"); // 10:59:59 Berlin
      serve();

      await run();

      expect(requestedPaths(fetchMock).filter((path) => path.startsWith("plan/"))).toEqual([
        "plan/8000105/260310/08",
        "plan/8000105/260310/09",
        "plan/8000105/260310/10",
        "plan/8000105/260310/11",
        "plan/8000105/260310/12",
      ]);
    });

    it("advances the slices on the next hour boundary", async () => {
      freezeTime("2026-03-10T10:00:00.000Z"); // 11:00 Berlin
      serve();

      await run();

      expect(requestedPaths(fetchMock).filter((path) => path.startsWith("plan/"))).toEqual([
        "plan/8000105/260310/09",
        "plan/8000105/260310/10",
        "plan/8000105/260310/11",
        "plan/8000105/260310/12",
        "plan/8000105/260310/13",
      ]);
    });

    it("walks across Berlin midnight", async () => {
      freezeTime("2026-03-10T22:30:00.000Z"); // 23:30 Berlin
      serve();

      await run();

      expect(requestedPaths(fetchMock).filter((path) => path.startsWith("plan/"))).toEqual([
        "plan/8000105/260310/21",
        "plan/8000105/260310/22",
        "plan/8000105/260310/23",
        "plan/8000105/260311/00",
        "plan/8000105/260311/01",
      ]);
    });

    it("skips the nonexistent hour when clocks spring forward", async () => {
      freezeTime("2026-03-29T01:30:00.000Z"); // 03:30 CEST, just after 02:00 became 03:00
      serve();

      await run();

      expect(requestedPaths(fetchMock).filter((path) => path.startsWith("plan/"))).toEqual([
        "plan/8000105/260329/00",
        "plan/8000105/260329/01",
        "plan/8000105/260329/03",
        "plan/8000105/260329/04",
        "plan/8000105/260329/05",
      ]);
    });

    it("requests the repeated hour once when clocks fall back", async () => {
      freezeTime("2026-10-25T00:30:00.000Z"); // 02:30 CEST, the first 02:xx
      serve();

      await run();

      expect(requestedPaths(fetchMock).filter((path) => path.startsWith("plan/"))).toEqual([
        "plan/8000105/261025/00",
        "plan/8000105/261025/01",
        "plan/8000105/261025/02",
        "plan/8000105/261025/03",
      ]);
      expect(fetchMock.requests).toHaveLength(5);
    });
  });

  describe("response mapping", () => {
    it("merges a planned departure with its change and maps it to a train", async () => {
      serve(
        {
          "260310/10": timetable([
            stop("s1", {
              tl: { c: "ICE", n: "591" },
              ar: { pt: t("10:15"), pp: "7", ppth: "Hamburg Hbf|Köln Hbf" },
              dp: { pt: t("10:20"), pp: "7", ppth: "Mannheim Hbf|Stuttgart Hbf" },
            }),
          ]),
        },
        timetable([
          stop("s1", {
            tl: null,
            dp: { ct: t("10:25"), cp: "9" },
            dpMessages: [{ id: "m1", t: "d", ext: "Defekt an der Tür", int: "internal only" }],
          }),
        ]),
      );

      const result = await run();

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "DB",
          category: "ICE",
          trainNumber: "591",
          destination: "Stuttgart Hbf",
          scheduledTime: "10:20",
          delay: 5,
          platform: "9",
          status: null,
          info: "Defekt an der Tür",
        },
      ]);
    });

    it("maps the same stop to an arrival using the first stop of the path as origin", async () => {
      serve({
        "260310/10": timetable([
          stop("s1", {
            ar: { pt: t("10:15"), pp: "7", ppth: "Hamburg Hbf|Köln Hbf" },
            dp: { pt: t("10:20"), pp: "7", ppth: "Mannheim Hbf|Stuttgart Hbf" },
          }),
        ]),
      });

      const { trains } = await run("arrivals");

      expect(trains).toEqual([
        {
          brand: "DB",
          category: "ICE",
          trainNumber: "591",
          origin: "Hamburg Hbf",
          scheduledTime: "10:15",
          delay: null,
          platform: "7",
          status: null,
          info: null,
        },
      ]);
      expect(trains[0]).not.toHaveProperty("destination");
    });

    it("does not set an origin on departures", async () => {
      serve({ "260310/10": timetable([dep("1", "10:20")]) });

      const { trains } = await run();

      expect(trains[0]).not.toHaveProperty("origin");
    });

    it("trims the category", async () => {
      serve({ "260310/10": timetable([dep("1", "10:20", {}, { tl: { c: " RE " } })]) });

      const { trains } = await run();

      expect(trains[0]).toMatchObject({ category: "RE", brand: "DB" });
    });

    it.each([
      ["ICE", "DB"],
      ["RE", "DB"],
      ["S", "DB"],
      ["FLX", "FlixTrain"],
      ["flx", "FlixTrain"],
      ["ARV", "Arriva"],
      ["BRB", "Transdev"],
      ["HLB", "HLB"],
      ["OE", "ODEG"],
      ["STN", "STB"],
      ["VIA", "Vias"],
      ["WB", "WestfalenBahn"],
      ["VLX", "Vogtlandbahn"],
      ["RJX", "OBB"],
      ["RJ", "OBB"],
      ["NJ", "OBB"],
      ["TGV", "SNCF"],
      ["EUR", "Eurostar"],
      ["THA", "Thalys"],
    ])("maps the category %s to the brand %s", async (category, brand) => {
      serve({ "260310/10": timetable([dep("1", "10:20", {}, { tl: { c: category } })]) });

      const { trains } = await run();

      expect(trains[0]).toMatchObject({ brand, category });
    });

    it("uses the changed platform and falls back to the planned one", async () => {
      serve({
        "260310/10": timetable([
          dep("1", "10:20", { pp: "7", cp: "8" }),
          dep("2", "10:21", { pp: "7" }),
          dep("3", "10:22", { pp: "" }),
          stop("4-dep", { tl: { n: "4" }, dp: { pt: t("10:23"), ppth: "A|B" } }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.platform)).toEqual(["8", "7", "", null]);
    });

    it("prefers the changed destination, then the planned one, then the path", async () => {
      serve({
        "260310/10": timetable([
          dep("1", "10:20", { ppth: "A|B", cpth: "A|C", pde: "Planned", cde: "Changed" }),
          dep("2", "10:21", { ppth: "A|B", cpth: "A|C", pde: "Planned" }),
          dep("3", "10:22", { ppth: "A|B", cpth: "A|C" }),
          dep("4", "10:23", { ppth: "A|B" }),
          dep("5", "10:24", { ppth: "Single" }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.destination)).toEqual([
        "Changed",
        "Planned",
        "C",
        "B",
        "Single",
      ]);
    });

    it("prefers the changed origin, then the planned one, then the first path stop", async () => {
      serve({
        "260310/10": timetable([
          arr("1", "10:20", { ppth: "A|B", cpth: "C|B", pde: "Planned", cde: "Changed" }),
          arr("2", "10:21", { ppth: "A|B", cpth: "C|B" }),
          arr("3", "10:22", { ppth: "A|B" }),
        ]),
      });

      const { trains } = await run("arrivals");

      expect(trains.map((train) => train.origin)).toEqual(["Changed", "C", "A"]);
    });

    it("decodes XML entities, handles quoted '>' and ignores comments and declarations", async () => {
      const plan =
        `<?xml version="1.0" encoding="UTF-8"?><!-- generated --><timetable>` +
        `<s id='s1'><tl t='p' c="ICE" n="591"/>` +
        `<dp pt="${t("10:20")}" pp="7" ppth="A|Frankfurt &amp; Offenbach &#xE4;&#246; &lt;&gt; &quot;&apos;"` +
        ` >` +
        `<m id="m1" ext="Zug &gt; Bus &amp; Rad"/></dp></s></timetable>`;
      serve({ "260310/10": plan });

      const { trains } = await run();

      expect(trains[0]).toMatchObject({
        destination: `Frankfurt & Offenbach äö <> "'`,
        info: "Zug > Bus & Rad",
      });
    });

    it("limits the board to 24 trains", async () => {
      const stops = Array.from({ length: 30 }, (_, index) =>
        dep(String(100 + index), `10:${String(index).padStart(2, "0")}`),
      );
      serve({ "260310/10": timetable(stops) });

      const { trains } = await run();

      expect(trains).toHaveLength(24);
      expect(trains[0]?.trainNumber).toBe("100");
      expect(trains.at(-1)?.trainNumber).toBe("123");
    });

    it("returns an empty board when nothing is published", async () => {
      serve();

      await expect(run()).resolves.toMatchObject({ trains: [], info: null });
    });
  });

  describe("status and filtering", () => {
    it("derives departure status from the 5-minute window around now", async () => {
      serve({
        "260310/09": timetable([dep("1", "09:55"), dep("0", "09:54")]),
        "260310/10": timetable([dep("2", "10:05"), dep("3", "10:06")]),
      });

      const { trains } = await run();

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["1", "departing"],
        ["2", "departing"],
        ["3", null],
      ]);
    });

    it("marks arrivals within the window as incoming", async () => {
      serve({
        "260310/10": timetable([arr("1", "10:05"), arr("2", "10:06")]),
      });

      const { trains } = await run("arrivals");

      expect(trains.map((train) => train.status)).toEqual(["incoming", null]);
    });

    it("keeps trains up to two hours ahead and drops later ones", async () => {
      serve({
        "260310/12": timetable([dep("1", "12:00"), dep("2", "12:01")]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.trainNumber)).toEqual(["1"]);
    });

    it("computes the delay from the changed time", async () => {
      serve(
        { "260310/10": timetable([dep("1", "10:20"), dep("2", "10:30"), dep("3", "10:40")]) },
        timetable([
          stop("1-dep", { tl: null, dp: { ct: t("10:20") } }),
          stop("2-dep", { tl: null, dp: { ct: t("10:51") } }),
          stop("3-dep", { tl: null, dp: { ct: t("10:35") } }),
        ]),
      );

      const { trains } = await run();

      // On-time and early trains have no delay.
      expect(trains.map((train) => [train.trainNumber, train.delay])).toEqual([
        ["1", null],
        ["2", 21],
        ["3", null],
      ]);
    });

    it("orders the board by scheduled time, using the actual time for status", async () => {
      serve(
        { "260310/10": timetable([dep("1", "10:08"), dep("2", "10:30")]) },
        timetable([stop("1-dep", { tl: null, dp: { ct: t("10:04") } })]),
      );

      const { trains } = await run();

      // An early train is "departing" by its actual time but keeps its scheduled time.
      expect(trains[0]).toMatchObject({
        trainNumber: "1",
        scheduledTime: "10:08",
        delay: null,
        status: "departing",
      });
    });

    it("keeps delayed trains from the lookback slices with their planned time", async () => {
      serve(
        {
          "260310/08": timetable([dep("1", "08:50"), dep("2", "08:55")]),
        },
        timetable([stop("1-dep", { tl: null, dp: { ct: t("10:05") } })]),
      );

      const { trains } = await run();

      // Train 2 left long ago; train 1 is delayed into the current window.
      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({
        trainNumber: "1",
        scheduledTime: "08:50",
        delay: 75,
        status: "departing",
      });
    });

    it("shows a train added through the change feed", async () => {
      serve(
        {},
        timetable([
          stop("new-dep", {
            tl: { c: "RE", n: "9999" },
            dp: { pt: t("10:40"), pp: "3", ppth: "A|Added Destination" },
          }),
        ]),
      );

      const { trains } = await run();

      expect(trains).toEqual([
        expect.objectContaining({
          trainNumber: "9999",
          destination: "Added Destination",
          platform: "3",
        }),
      ]);
    });

    it("ignores change-feed stops that have no planned time or label", async () => {
      serve(
        {},
        timetable([
          stop("a-dep", { tl: null, dp: { ct: t("10:40"), cp: "1", cde: "Nowhere" } }),
          stop("b-dep", { dp: { ct: t("10:40"), cde: "Nowhere" } }),
        ]),
      );

      const { trains } = await run();

      expect(trains).toEqual([]);
    });

    it("keeps a cancelled train by its scheduled time and shows no status window", async () => {
      serve(
        {
          "260310/09": timetable([dep("1", "09:56"), dep("2", "09:50")]),
          "260310/10": timetable([dep("3", "10:30"), dep("4", "10:31")]),
        },
        timetable([
          stop("1-dep", { tl: null, dp: { cs: "c" } }),
          stop("2-dep", { tl: null, dp: { cs: "c" } }),
          stop("3-dep", { tl: null, dp: { cs: "c" } }),
        ]),
      );

      const { trains } = await run();

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["1", "cancelled"],
        ["3", "cancelled"],
        ["4", null],
      ]);
      expect(trains[0]?.delay).toBeNull();
    });

    it("shows no delay for a cancelled train with a later changed time", async () => {
      serve({ "260310/10": timetable([dep("1", "10:20", { cs: "c", ct: t("10:35") })]) });

      const { trains } = await run();

      expect(trains[0]).toMatchObject({ status: "cancelled", delay: null });
    });

    it("honours a planned cancellation unless the change status overrides it", async () => {
      serve({
        "260310/10": timetable([
          dep("1", "10:20", { ps: "c" }),
          dep("2", "10:21", { ps: "c", cs: "p" }),
          dep("3", "10:22", { ps: "p", cs: "c" }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["1", "cancelled"],
        ["2", null],
        ["3", "cancelled"],
      ]);
    });

    it("marks cancelled arrivals using the arrival event", async () => {
      serve({
        "260310/10": timetable([
          arr("1", "10:20", { cs: "c" }),
          stop("2-arr", {
            tl: { n: "2" },
            ar: { pt: t("10:21"), ppth: "A|B" },
            dp: { pt: t("10:25"), cs: "c", ppth: "A|B" },
          }),
        ]),
      });

      const { trains } = await run("arrivals");

      expect(trains.map((train) => [train.trainNumber, train.status])).toEqual([
        ["1", "cancelled"],
        ["2", null],
      ]);
    });

    it("hides events flagged as hidden", async () => {
      serve({
        "260310/10": timetable([dep("1", "10:20", { hi: "1" }), dep("2", "10:21", { hi: "0" })]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("hides a hidden change-feed event over a visible plan", async () => {
      serve(
        { "260310/10": timetable([dep("1", "10:20")]) },
        timetable([stop("1-dep", { tl: null, dp: { hi: "1" } })]),
      );

      await expect(run()).resolves.toMatchObject({ trains: [] });
    });

    it("only lists stops that have the requested event", async () => {
      serve({
        "260310/10": timetable([
          dep("1", "10:20"),
          arr("2", "10:20"),
          // A terminating train has no departure; a starting one has no arrival.
          stop("3-end", { tl: { n: "3" }, ar: { pt: t("10:20"), ppth: "A|B" } }),
        ]),
      });

      const departures = await run("departures");
      const arrivals = await run("arrivals");

      expect(departures.trains.map((train) => train.trainNumber)).toEqual(["1"]);
      expect(arrivals.trains.map((train) => train.trainNumber)).toEqual(["2", "3"]);
    });

    it.each(["BUS", "bus", "SEV", "SCHIFF", "STR", "U", "UBAHN"])(
      "skips non-rail category %s",
      async (category) => {
        serve({
          "260310/10": timetable([
            dep("1", "10:20", {}, { tl: { c: category } }),
            dep("2", "10:21"),
          ]),
        });

        const { trains } = await run();

        expect(trains.map((train) => train.trainNumber)).toEqual(["2"]);
      },
    );

    it("skips stops without a category, number, direction or valid planned time", async () => {
      serve({
        "260310/10": timetable([
          dep("1", "10:20", {}, { tl: { c: "" } }),
          dep("2", "10:20", {}, { tl: { c: "  " } }),
          stop("3-dep", { tl: { c: "ICE", n: "" }, dp: { pt: t("10:20"), ppth: "A|B" } }),
          dep("4", "10:20", { ppth: "", pde: "" }),
          dep("5", "10:20", { pt: "26031010" }),
          dep("6", "10:20", { pt: "26031010AB" }),
          dep("7", "10:20", { pt: "2602301020" }), // 30 February
          dep("8", "10:21"),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.trainNumber)).toEqual(["8"]);
    });

    it("drops stops without a label even if the plan lacks one", async () => {
      serve({
        "260310/10": timetable([stop("x-dep", { tl: null, dp: { pt: t("10:20"), ppth: "A|B" } })]),
      });

      await expect(run()).resolves.toMatchObject({ trains: [] });
    });

    it("resolves the repeated autumn hour to the occurrence closest to now", async () => {
      // 02:15 happens twice on 25 October 2026 (00:15Z and 01:15Z).
      freezeTime("2026-10-25T01:10:00.000Z"); // 02:10 CET, second pass through 02:xx
      serve({
        "261025/02": timetable([stop("1-dep", { dp: { pt: "2610250215", ppth: "A|B" } })]),
      });

      const { trains } = await run();

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ scheduledTime: "02:15", status: "departing" });
    });

    it("drops the earlier occurrence of the repeated hour when it is already past", async () => {
      freezeTime("2026-10-25T00:30:00.000Z"); // 02:30 CEST; 02:15 CEST was 15 minutes ago
      serve({ "261025/02": timetable([stop("1-dep", { dp: { pt: "2610250215", ppth: "A|B" } })]) });

      await expect(run()).resolves.toMatchObject({ trains: [] });
    });

    it("drops planned times that do not exist when clocks spring forward", async () => {
      freezeTime("2026-03-29T01:30:00.000Z"); // 03:30 CEST
      serve({
        "260329/03": timetable([
          stop("1-dep", { dp: { pt: "2603290230", ppth: "A|B" } }),
          stop("2-dep", { tl: { n: "2" }, dp: { pt: "2603290345", ppth: "A|B" } }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => [train.trainNumber, train.scheduledTime])).toEqual([
        ["2", "03:45"],
      ]);
    });

    it("lists trains after midnight in order with the Berlin local time", async () => {
      freezeTime("2026-03-10T22:30:00.000Z"); // 23:30 Berlin
      serve({
        "260311/00": timetable([
          stop("2-dep", { tl: { n: "2" }, dp: { pt: "2603110010", ppth: "A|B" } }),
        ]),
        "260310/23": timetable([
          stop("1-dep", { tl: { n: "1" }, dp: { pt: "2603102345", ppth: "A|B" } }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => [train.trainNumber, train.scheduledTime])).toEqual([
        ["1", "23:45"],
        ["2", "00:10"],
      ]);
    });

    it("formats the scheduled time from the Berlin wall clock in summer", async () => {
      freezeTime("2026-07-10T08:00:00.000Z"); // 10:00 CEST
      serve({
        "260710/10": timetable([stop("1-dep", { dp: { pt: "2607101020", ppth: "A|B" } })]),
      });

      const { trains } = await run();

      expect(trains[0]?.scheduledTime).toBe("10:20");
    });
  });

  describe("merging", () => {
    it("shows a stop present in several slices and the change feed once", async () => {
      const planned = timetable([dep("1", "10:20")]);
      serve(
        { "260310/09": planned, "260310/10": planned },
        timetable([stop("1-dep", { tl: null, dp: { ct: t("10:22") } })]),
      );

      const { trains } = await run();

      expect(trains).toHaveLength(1);
      expect(trains[0]?.delay).toBe(2);
    });

    it("lets change attributes override planned ones while keeping the rest", async () => {
      serve(
        { "260310/10": timetable([dep("1", "10:20", { pp: "7", ppth: "A|B" })]) },
        timetable([stop("1-dep", { tl: { c: "IC", n: "1" }, dp: { cp: "3", cde: "Elsewhere" } })]),
      );

      const { trains } = await run();

      expect(trains[0]).toMatchObject({
        category: "IC",
        trainNumber: "1",
        scheduledTime: "10:20",
        platform: "3",
        destination: "Elsewhere",
      });
    });

    it("keeps separate rows for separate stop ids of one train when departing", async () => {
      serve({
        "260310/10": timetable([
          stop("a-dep", { tl: { n: "1" }, dp: { pt: t("10:20"), ppth: "A|North" } }),
          stop("b-dep", { tl: { n: "1" }, dp: { pt: t("10:20"), ppth: "A|South" } }),
        ]),
      });

      const { trains } = await run();

      expect(trains.map((train) => train.destination)).toEqual(["North", "South"]);
    });

    it("joins the origins of arrivals that are otherwise identical", async () => {
      serve({
        "260310/10": timetable([
          stop("a-arr", {
            tl: { n: "7" },
            ar: { pt: t("10:20"), pp: "4", ppth: "Hamburg Hbf|Köln Hbf" },
          }),
          stop("b-arr", {
            tl: { n: "7" },
            ar: { pt: t("10:20"), pp: "4", ppth: "Berlin Hbf|Köln Hbf" },
          }),
          stop("c-arr", {
            tl: { n: "7" },
            ar: { pt: t("10:20"), pp: "4", ppth: "Hamburg Hbf|Köln Hbf" },
          }),
        ]),
      });

      const { trains } = await run("arrivals");

      expect(trains).toHaveLength(1);
      expect(trains[0]).toMatchObject({ trainNumber: "7", origin: "Hamburg Hbf / Berlin Hbf" });
    });

    it("keeps arrivals apart when any displayed field differs", async () => {
      serve({
        "260310/10": timetable([
          stop("a-arr", { tl: { n: "7" }, ar: { pt: t("10:20"), pp: "4", ppth: "A|X" } }),
          stop("b-arr", { tl: { n: "7" }, ar: { pt: t("10:20"), pp: "5", ppth: "B|X" } }),
          stop("c-arr", { tl: { n: "8" }, ar: { pt: t("10:20"), pp: "4", ppth: "C|X" } }),
          stop("d-arr", { tl: { n: "7", c: "RE" }, ar: { pt: t("10:20"), pp: "4", ppth: "D|X" } }),
          stop("e-arr", {
            tl: { n: "7" },
            ar: { pt: t("10:20"), ct: t("10:25"), pp: "4", ppth: "E|X" },
          }),
          stop("f-arr", {
            tl: { n: "7" },
            ar: { pt: t("10:20"), pp: "4", ppth: "F|X" },
            arMessages: [{ id: "1", ext: "Info" }],
          }),
        ]),
      });

      const { trains } = await run("arrivals");

      expect(trains.map((train) => train.origin)).toEqual(["A", "B", "C", "D", "E", "F"]);
    });

    it("limits arrivals to 24 after joining origins", async () => {
      const stops = Array.from({ length: 30 }, (_, index) =>
        arr(String(100 + index), `10:${String(index).padStart(2, "0")}`),
      );
      serve({ "260310/10": timetable(stops) });

      const { trains } = await run("arrivals");

      expect(trains).toHaveLength(24);
    });
  });

  describe("messages", () => {
    it("combines stop-level and event-level messages, hiding internal and deleted ones", async () => {
      serve({
        "260310/10": timetable([
          dep(
            "1",
            "10:20",
            {},
            {
              messages: [
                { id: "s1", ext: "Stop message" },
                { id: "s2", ext: "Deleted", del: "1" },
              ],
              dpMessages: [
                { id: "e1", ext: "  Event message  " },
                { id: "e2", int: "internal only" },
                { id: "e3", ext: "   " },
                { id: "e4", ext: "Stop message" },
              ],
            },
          ),
        ]),
      });

      const { trains } = await run();

      expect(trains[0]?.info).toBe("Stop message; Event message");
    });

    it("applies message changes by id: override, delete and add", async () => {
      serve(
        {
          "260310/10": timetable([
            dep(
              "1",
              "10:20",
              {},
              {
                dpMessages: [
                  { id: "a", ext: "Original" },
                  { id: "b", ext: "To be removed" },
                  { ext: "Planned anonymous" },
                ],
              },
            ),
          ]),
        },
        timetable([
          stop("1-dep", {
            tl: null,
            dp: { ct: t("10:20") },
            dpMessages: [
              { id: "a", ext: "Updated" },
              { id: "b", ext: "To be removed", del: "1" },
              { id: "c", ext: "Added" },
              { ext: "Changed anonymous" },
            ],
          }),
        ]),
      );

      const { trains } = await run();

      expect(trains[0]?.info).toBe("Updated; Planned anonymous; Added; Changed anonymous");
    });

    it("merges stop-level messages from plan and change feed", async () => {
      serve(
        {
          "260310/10": timetable([dep("1", "10:20", {}, { messages: [{ id: "a", ext: "Plan" }] })]),
        },
        timetable([stop("1-dep", { tl: null, messages: [{ id: "b", ext: "Change" }] })]),
      );

      const { trains } = await run();

      expect(trains[0]?.info).toBe("Plan; Change");
    });

    it("uses messages on the change feed's timetable as the board info", async () => {
      serve(
        { "260310/10": timetable([], [{ id: "p", ext: "Plan-level message is ignored" }]) },
        timetable(
          [],
          [
            { id: "1", ext: "Streckensperrung Frankfurt – Mainz" },
            { id: "2", ext: "Gestrichen", del: "1" },
            { id: "3", int: "internal" },
            { id: "4", ext: "Streckensperrung Frankfurt – Mainz" },
            { id: "5", ext: "Aufzug defekt" },
          ],
        ),
      );

      const result = await run();

      expect(result.info).toBe("Streckensperrung Frankfurt – Mainz; Aufzug defekt");
    });

    it("has no board info without change-feed messages", async () => {
      serve({ "260310/10": timetable([], [{ id: "p", ext: "Plan-level message" }]) });

      const result = await run();

      expect(result.info).toBeNull();
    });
  });

  describe("errors", () => {
    let logs: ReturnType<typeof captureLogs>;

    beforeEach(() => {
      logs = captureLogs();
    });

    const rejection = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

    it.each([401, 403])("reports rejected credentials (%i) as a 503", async (status) => {
      fetchMock.on("/fchg/", textResponse("denied", { status }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: "DB Timetables credentials were rejected.",
        upstream: { host: "apis.deutschebahn.com", status },
      });
      expect(logs.warn).toHaveBeenCalledWith("[DB Timetables] Upstream request failed", {
        path: "fchg/8000105",
        status,
      });
    });

    it("reports rate limiting (429) as a 503 for the German source", async () => {
      fetchMock.on("/fchg/", textResponse("slow down", { status: 429 }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("German train data source has reached its request limit"),
      });
    });

    it("treats a missing plan slice (404) as empty", async () => {
      fetchMock.on("/fchg/", textResponse(timetable()));
      fetchMock.on("/plan/8000105/260310/09", textResponse("", { status: 404 }));
      fetchMock.on("/plan/", textResponse(timetable([dep("1", "10:20")])));

      const { trains } = await run();

      expect(trains.map((train) => train.trainNumber)).toEqual(["1"]);
    });

    it("treats every plan being absent (404) as an empty board", async () => {
      fetchMock.on("/fchg/", textResponse(timetable()));
      fetchMock.on("/plan/", textResponse("", { status: 404 }));

      await expect(run()).resolves.toMatchObject({ trains: [] });
    });

    it("reports an unknown station on the change feed (404) as 404", async () => {
      fetchMock.on("/fchg/", textResponse("", { status: 404 }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 404,
        message: "This station is not supported by DB Timetables.",
      });
    });

    it("passes an upstream gateway timeout (504) through", async () => {
      fetchMock.on("/fchg/", textResponse("", { status: 504 }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 504,
        message: expect.stringContaining("German"),
      });
    });

    it("reports a client-side timeout as 504", async () => {
      fetchMock.fail(new DOMException("The operation was aborted.", "AbortError"));

      await expect(run()).rejects.toMatchObject({
        statusCode: 504,
        message: expect.stringContaining("taking too long"),
      });
    });

    it.each([500, 502, 503, 400])("maps upstream HTTP %i to a generic 502", async (status) => {
      fetchMock.on("/fchg/", textResponse("", { status }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 502,
        message: "Unable to load German train data. Please try again.",
        upstream: { host: "apis.deutschebahn.com", status },
      });
    });

    it("maps network failures to a generic 502", async () => {
      fetchMock.fail();

      await expect(run()).rejects.toMatchObject({
        statusCode: 502,
        message: "Unable to load German train data. Please try again.",
      });
    });

    it("fails the board when any plan slice fails", async () => {
      fetchMock.on("/fchg/", textResponse(timetable()));
      fetchMock.on("/plan/8000105/260310/11", textResponse("", { status: 500 }));
      fetchMock.on("/plan/", textResponse(timetable([dep("1", "10:20")])));

      await expect(run()).rejects.toMatchObject({ statusCode: 502 });
    });

    it("does not leak credentials in error messages", async () => {
      fetchMock.on("/fchg/", textResponse("", { status: 401 }));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = (await rejection(run())) as ScraperError;

      expect(error.message).not.toContain("api-key");
      expect(JSON.stringify(error.upstream)).not.toContain("api-key");
    });

    const invalidBodies: [string, string][] = [
      ["empty body", ""],
      ["plain text", "not xml"],
      ["HTML error page", "<html><body>Bad gateway</body></html>"],
      ["wrong root element", "<timetables/>"],
      ["unclosed root", "<timetable>"],
      ["mismatched closing tag", "<timetable><s id='1'></timetable>"],
      ["stray closing tag", "</timetable>"],
      ["two roots", "<timetable/><timetable/>"],
      ["text inside the root", "<timetable>oops</timetable>"],
      ["stop without an id", "<timetable><s/></timetable>"],
      ["unquoted attribute", "<timetable station=x/>"],
      ["garbage between attributes", '<timetable a="1" junk b="2"/>'],
      ["DOCTYPE declaration", "<!DOCTYPE timetable><timetable/>"],
      ["null character reference", '<timetable><s id="&#0;"/></timetable>'],
      ["surrogate character reference", '<timetable><s id="&#xD800;"/></timetable>'],
      ["out-of-range character reference", '<timetable><s id="&#x110000;"/></timetable>'],
      ["deep nesting", `<timetable>${"<a>".repeat(40)}${"</a>".repeat(40)}</timetable>`],
      ["unterminated tag", "<timetable"],
    ];

    it.each(invalidBodies)("rejects an invalid change feed: %s", async (_label, body) => {
      fetchMock.on("/fchg/", textResponse(body));
      fetchMock.on("/plan/", textResponse(timetable()));

      const error = await rejection(run());

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 502,
        message: "Invalid response from DB Timetables.",
      });
      expect((error as ScraperError).cause).toBeInstanceOf(Error);
    });

    it("rejects an invalid plan slice", async () => {
      fetchMock.on("/fchg/", textResponse(timetable()));
      fetchMock.on("/plan/8000105/260310/10", textResponse("<html/>"));
      fetchMock.on("/plan/", textResponse(timetable()));

      await expect(run()).rejects.toMatchObject({
        statusCode: 502,
        message: "Invalid response from DB Timetables.",
      });
    });
  });

  describe("caching", () => {
    type FakeCache = {
      store: Map<string, string>;
      puts: { url: string; cacheControl: string | null; contentType: string | null }[];
      match: ReturnType<typeof vi.fn>;
      put: ReturnType<typeof vi.fn>;
    };

    function fakeCache(): FakeCache {
      const cache: FakeCache = {
        store: new Map(),
        puts: [],
        match: vi.fn(async (url: string) =>
          cache.store.has(url) ? new Response(cache.store.get(url)) : undefined,
        ),
        put: vi.fn(async (url: string, response: Response) => {
          cache.puts.push({
            url,
            cacheControl: response.headers.get("Cache-Control"),
            contentType: response.headers.get("Content-Type"),
          });
          cache.store.set(url, await response.text());
        }),
      };
      return cache;
    }

    function stubCaches(cache: FakeCache) {
      const open = vi.fn(async () => cache);
      vi.stubGlobal("caches", { open });
      return open;
    }

    const keyFor = (path: string) =>
      new RegExp(
        `^https://api\\.railradar24\\.com/__internal/db-timetables/v1/[0-9a-f]{64}/${path}$`,
      );

    it("caches responses with per-type lifetimes under a key without credentials", async () => {
      const cache = fakeCache();
      const open = stubCaches(cache);
      serve({ "260310/10": timetable([dep("1", "10:20")]) });

      await run();

      expect(open).toHaveBeenCalledWith("db-timetables");
      expect(cache.puts).toHaveLength(6);
      const byPath = (path: string) => cache.puts.find((put) => keyFor(path).test(put.url));

      // Non-empty plans last a day, empty plans are retried after a minute, changes live 30 s.
      expect(byPath("plan/8000105/260310/10")?.cacheControl).toBe("public, max-age=86400");
      expect(byPath("plan/8000105/260310/09")?.cacheControl).toBe("public, max-age=60");
      expect(byPath("fchg/8000105")?.cacheControl).toBe("public, max-age=30");
      for (const put of cache.puts) {
        expect(put.contentType).toBe("application/xml");
        expect(put.url).not.toContain("client-id");
        expect(put.url).not.toContain("api-key");
      }
    });

    it("serves repeat requests, in either direction, from the cache", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      serve({ "260310/10": timetable([dep("1", "10:20"), arr("2", "10:25")]) });

      const first = await run("departures");
      const requestsAfterFirst = fetchMock.requests.length;
      const second = await run("departures");
      const arrivals = await run("arrivals");

      expect(requestsAfterFirst).toBe(6);
      expect(fetchMock.requests).toHaveLength(6);
      expect(second.trains).toEqual(first.trains);
      expect(arrivals.trains.map((train) => train.trainNumber)).toEqual(["2"]);
    });

    it("keeps accounts apart", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      serve();

      await scrapeGermanTrains(STATION, "departures", ENV);
      await scrapeGermanTrains(STATION, "departures", { ...ENV, DB_CLIENT_ID: "other-client" });

      expect(fetchMock.requests).toHaveLength(12);
      expect(new Set(cache.store.keys()).size).toBe(12);
    });

    it("refetches when the cached body is not valid XML", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      serve({ "260310/10": timetable([dep("1", "10:20")]) });
      await run();
      for (const key of cache.store.keys()) cache.store.set(key, "<corrupt");
      fetchMock.requests.length = 0;

      const { trains } = await run();

      expect(fetchMock.requests).toHaveLength(6);
      expect(trains.map((train) => train.trainNumber)).toEqual(["1"]);
    });

    it("ignores cached error responses", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      cache.match.mockImplementation(async () => new Response("", { status: 500 }));
      serve();

      await run();

      expect(fetchMock.requests).toHaveLength(6);
    });

    it("does not cache a missing plan so it is retried", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      fetchMock.on("/fchg/", textResponse(timetable()));
      fetchMock.on("/plan/8000105/260310/09", textResponse("", { status: 404 }));
      fetchMock.on("/plan/", textResponse(timetable()));
      captureLogs();

      await run();

      expect(cache.puts).toHaveLength(5);
      expect([...cache.store.keys()].some((key) => key.endsWith("/plan/8000105/260310/09"))).toBe(
        false,
      );
    });

    it("still fetches when the cache lookup throws", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      cache.match.mockRejectedValue(new Error("cache down"));
      serve({ "260310/10": timetable([dep("1", "10:20")]) });

      const { trains } = await run();

      expect(trains).toHaveLength(1);
      expect(fetchMock.requests).toHaveLength(6);
    });

    it("still returns the result when storing in the cache fails", async () => {
      const cache = fakeCache();
      stubCaches(cache);
      cache.put.mockRejectedValue(new Error("quota"));
      serve({ "260310/10": timetable([dep("1", "10:20")]) });

      const { trains } = await run();

      expect(trains).toHaveLength(1);
    });

    it("works when the Cache API cannot be opened", async () => {
      vi.stubGlobal("caches", {
        open: vi.fn(async () => {
          throw new Error("unsupported");
        }),
      });
      serve({ "260310/10": timetable([dep("1", "10:20")]) });

      const { trains } = await run();

      expect(trains).toHaveLength(1);
      expect(fetchMock.requests).toHaveLength(6);
    });
  });

  describe("exported helpers", () => {
    it("formats and parses DB times in Berlin local time", () => {
      const winter = Date.parse("2026-03-10T09:00:00Z");
      const summer = Date.parse("2026-07-10T08:00:00Z");

      expect(formatDbTime(winter)).toBe("2603101000");
      expect(formatDbTime(summer)).toBe("2607101000");
      expect(parseDbTime("2603101000", winter)).toBe(winter);
      expect(parseDbTime("2607101000", summer)).toBe(summer);
    });

    it.each([undefined, "", "260310100", "26031010000", "26031010ab", "2602301000", "2603290230"])(
      "rejects the DB time %j",
      (value) => {
        expect(parseDbTime(value, Date.now())).toBeNaN();
      },
    );

    it("picks the occurrence of the repeated hour closest to the reference", () => {
      const first = Date.parse("2026-10-25T00:15:00Z"); // 02:15 CEST
      const second = Date.parse("2026-10-25T01:15:00Z"); // 02:15 CET

      expect(parseDbTime("2610250215", first - 600_000)).toBe(first);
      expect(parseDbTime("2610250215", second + 600_000)).toBe(second);
    });

    it("parses timetables into stops, events and messages", () => {
      const parsed = parseTimetable(
        timetable(
          [
            dep(
              "1",
              "10:20",
              { cp: "3" },
              {
                messages: [{ id: "s", ext: "Stop" }],
                dpMessages: [{ id: "e", ext: "Event" }],
              },
            ),
            // Nested connection stops must not become rows.
            el("s", { id: "2" }, [
              el("tl", { c: "RE", n: "2" }),
              el("ar", {}, [el("conn", {}, [el("s", { id: "nested" })])]),
            ]),
          ],
          [{ id: "root", ext: "Root" }],
        ),
      );

      expect(parsed.messages).toEqual([{ id: "root", ext: "Root" }]);
      expect(parsed.stops.map((parsedStop) => parsedStop.id)).toEqual(["1-dep", "2"]);
      expect(parsed.stops[0]).toMatchObject({
        label: { c: "ICE", n: "1" },
        messages: [{ id: "s", ext: "Stop" }],
        departure: {
          attributes: { cp: "3", pt: t("10:20") },
          messages: [{ id: "e", ext: "Event" }],
        },
      });
      expect(parsed.stops[0]?.arrival).toBeUndefined();
    });

    it("merges timetables with later sources winning and root messages from the changes", () => {
      const merged = mergeTimetables(
        [
          parseTimetable(timetable([dep("1", "10:20")], [{ id: "p", ext: "Plan" }])),
          parseTimetable(timetable([stop("1-dep", { dp: { pp: "8" }, tl: { c: "IC", n: "1" } })])),
        ],
        parseTimetable(
          timetable([stop("1-dep", { tl: null, dp: { cp: "9" } })], [{ id: "c", ext: "Change" }]),
        ),
      );

      expect(merged.messages).toEqual([{ id: "c", ext: "Change" }]);
      expect(merged.stops).toHaveLength(1);
      expect(merged.stops[0]?.label).toMatchObject({ c: "IC", n: "1" });
      expect(merged.stops[0]?.departure?.attributes).toMatchObject({
        pt: t("10:20"),
        pp: "8",
        cp: "9",
      });
    });

    it("builds message text from public messages only", () => {
      expect(getMessageText([])).toBeNull();
      expect(
        getMessageText([{ int: "internal" }, { ext: " " }, { ext: "x", del: "1" }]),
      ).toBeNull();
      expect(getMessageText([{ ext: " A " }, { ext: "B" }, { ext: "A" }])).toBe("A; B");
    });
  });
});
