import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeFranceTrains } from "../../src/scrapers/france";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

// 10:00 in Paris (CET). Navitia times are Paris wall-clock "YYYYMMDDTHHMMSS" strings.
const NOW = "2026-03-10T09:00:00.000Z";
const ENV = { SNCF_API_KEY: "test-key" };
const HOST = "api.navitia.io";

type Link = { type: string; id: string };

type DisplayInformations = {
  direction: string;
  network: string | null;
  commercial_mode: string | null;
  physical_mode: string | null;
  headsign: string | null;
  code: string | null;
  trip_short_name: string | null;
  links?: Link[];
};

type Passage = {
  display_informations: DisplayInformations;
  stop_date_time: {
    departure_date_time?: string;
    base_departure_date_time?: string;
    arrival_date_time?: string;
    base_arrival_date_time?: string;
  };
  stop_point?: { platform_code?: string | null };
  links?: Link[];
};

type PassageOverrides = {
  info?: Partial<DisplayInformations>;
  stop_date_time?: Passage["stop_date_time"];
  stop_point?: Passage["stop_point"];
  links?: Link[];
};

function passage({ info, stop_date_time, stop_point, links }: PassageOverrides = {}): Passage {
  return {
    display_informations: {
      direction: "Strasbourg-Ville (Strasbourg)",
      network: "TGV INOUI",
      commercial_mode: "TGV INOUI",
      physical_mode: "Train grande vitesse",
      headsign: "6201",
      code: "",
      trip_short_name: "6201",
      ...info,
    },
    stop_date_time: stop_date_time ?? {
      base_departure_date_time: "20260310T101000",
      departure_date_time: "20260310T101000",
      base_arrival_date_time: "20260310T101000",
      arrival_date_time: "20260310T101000",
    },
    ...(stop_point ? { stop_point } : {}),
    ...(links ? { links } : {}),
  };
}

describe("scrapeFranceTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const departures = (items: Passage[], disruptions?: unknown[]) =>
    jsonResponse({ departures: items, ...(disruptions ? { disruptions } : {}) });

  const arrivals = (items: Passage[], disruptions?: unknown[]) =>
    jsonResponse({ arrivals: items, ...(disruptions ? { disruptions } : {}) });

  const trainsFor = async (items: Passage[], disruptions?: unknown[]) => {
    fetchMock.once(HOST, departures(items, disruptions));
    return (await scrapeFranceTrains("FR686006", "departures", ENV)).trains;
  };

  describe("request", () => {
    it("requests the Navitia departures of the stop area with Basic auth", async () => {
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", "departures", ENV);

      const url = fetchMock.url();
      expect(url.origin).toBe("https://api.navitia.io");
      expect(url.pathname).toBe(
        "/v1/coverage/sncf/stop_areas/stop_area%3ASNCF%3A87686006/departures",
      );
      expect(decodeURIComponent(url.pathname)).toContain("stop_area:SNCF:87686006");
      expect(url.searchParams.get("data_freshness")).toBe("realtime");
      expect(url.searchParams.get("count")).toBe("24");
      expect(url.searchParams.get("disable_geojson")).toBe("true");
      expect(fetchMock.requests[0]?.headers.get("authorization")).toBe(
        `Basic ${btoa("test-key:")}`,
      );
    });

    it("uses the arrivals endpoint when asked", async () => {
      fetchMock.on(HOST, arrivals([]));

      await scrapeFranceTrains("FR686006", "arrivals", ENV);

      expect(fetchMock.url().pathname).toMatch(/\/stop_area%3ASNCF%3A87686006\/arrivals$/);
    });

    it("defaults to departures", async () => {
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", undefined, ENV);

      expect(fetchMock.url().pathname).toMatch(/\/departures$/);
    });

    it("starts the board five minutes ago in Paris wall-clock time", async () => {
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", "departures", ENV);

      // 10:00 Paris - 5 minutes, even though the host zone is UTC.
      expect(fetchMock.url().searchParams.get("from_datetime")).toBe("20260310T095500");
    });

    it("uses summer time for the board start (CEST)", async () => {
      freezeTime("2026-07-01T08:00:00.000Z");
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", "departures", ENV);

      expect(fetchMock.url().searchParams.get("from_datetime")).toBe("20260701T095500");
    });

    it("rolls over the date correctly around Paris midnight", async () => {
      freezeTime("2026-03-09T23:02:00.000Z"); // 00:02 on the 10th in Paris
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", "departures", ENV);

      expect(fetchMock.url().searchParams.get("from_datetime")).toBe("20260309T235700");
    });

    it("does not render midnight as hour 24", async () => {
      freezeTime("2026-03-09T23:00:00.000Z"); // 00:00 on the 10th in Paris
      fetchMock.on(HOST, departures([]));

      await scrapeFranceTrains("FR686006", "departures", ENV);

      expect(fetchMock.url().searchParams.get("from_datetime")).toBe("20260309T235500");
    });

    it("throws a 500 ScraperError without any request when the API key is missing", async () => {
      const noEnv = await scrapeFranceTrains("FR686006").catch((error: unknown) => error);
      const emptyKey = await scrapeFranceTrains("FR686006", "departures", {
        SNCF_API_KEY: "",
      }).catch((error: unknown) => error);
      const wrongType = await scrapeFranceTrains("FR686006", "departures", {
        SNCF_API_KEY: 123,
      }).catch((error: unknown) => error);

      for (const error of [noEnv, emptyKey, wrongType]) {
        expect(error).toBeInstanceOf(ScraperError);
        expect(error).toMatchObject({
          statusCode: 500,
          message: "SNCF API key is not configured.",
        });
      }
      expect(fetchMock.requests).toHaveLength(0);
    });
  });

  describe("mapping", () => {
    it("maps a departure to a train", async () => {
      fetchMock.on(
        HOST,
        departures([
          passage({
            stop_date_time: {
              base_departure_date_time: "20260310T101000",
              departure_date_time: "20260310T101300",
            },
            stop_point: { platform_code: "5" },
          }),
        ]),
      );

      const result = await scrapeFranceTrains("FR686006", "departures", ENV);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "TGV INOUI",
          category: "TGV",
          trainNumber: "6201",
          destination: "Strasbourg-Ville",
          scheduledTime: "10:10",
          delay: 3,
          platform: "5",
          status: null,
          info: null,
        },
      ]);
    });

    it("maps an arrival without inventing an origin", async () => {
      fetchMock.on(
        HOST,
        arrivals([
          passage({
            stop_date_time: {
              base_arrival_date_time: "20260310T102000",
              arrival_date_time: "20260310T102000",
            },
          }),
        ]),
      );

      const result = await scrapeFranceTrains("FR686006", "arrivals", ENV);

      expect(result.trains).toEqual([
        {
          brand: "TGV INOUI",
          category: "TGV",
          trainNumber: "6201",
          scheduledTime: "10:20",
          delay: null,
          platform: null,
          status: null,
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("origin");
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("shows the scheduled time of the requested board type", async () => {
      const stop_date_time = {
        base_departure_date_time: "20260310T101000",
        departure_date_time: "20260310T101000",
        base_arrival_date_time: "20260310T100800",
        arrival_date_time: "20260310T100800",
      };
      fetchMock.once(HOST, departures([passage({ stop_date_time })]));
      fetchMock.once(HOST, arrivals([passage({ stop_date_time })]));

      const dep = await scrapeFranceTrains("FR686006", "departures", ENV);
      const arr = await scrapeFranceTrains("FR686006", "arrivals", ENV);

      expect(dep.trains[0]?.scheduledTime).toBe("10:10");
      expect(arr.trains[0]?.scheduledTime).toBe("10:08");
    });

    it("strips the trailing parenthetical from destinations only", async () => {
      const trains = await trainsFor([
        passage({ info: { direction: "Paris Gare de Lyon (Paris)" } }),
        passage({ info: { direction: "Lyon (Part-Dieu) (Lyon)" } }),
        passage({ info: { direction: "Bordeaux-St-Jean" } }),
      ]);

      expect(trains.map((train) => train.destination)).toEqual([
        "Paris Gare de Lyon",
        "Lyon (Part-Dieu)",
        "Bordeaux-St-Jean",
      ]);
    });

    it("falls back to commercial mode and then SNCF for the brand", async () => {
      const trains = await trainsFor([
        passage({ info: { network: "Transilien", commercial_mode: "Train" } }),
        passage({ info: { network: null, commercial_mode: "TER" } }),
        passage({ info: { network: null, commercial_mode: null } }),
      ]);

      expect(trains.map((train) => train.brand)).toEqual(["Transilien", "TER", "SNCF"]);
    });

    it("prefers the line code as category", async () => {
      const trains = await trainsFor([
        passage({
          info: {
            code: "B",
            physical_mode: "RER / Transilien",
            headsign: "EJAN",
            trip_short_name: "1",
          },
        }),
        passage({
          info: { code: "  H  ", physical_mode: "Train", headsign: "NORA", trip_short_name: "1" },
        }),
      ]);

      expect(trains.map((train) => train.category)).toEqual(["B", "H"]);
    });

    it.each([
      ["Train grande vitesse", "TGV"],
      ["TER / Intercités", "TER"],
      ["RER / Transilien", "RER"],
      ["Navette ferrée", "Navette"],
      ["Tramway", "Tram"],
      ["Train", "Train"],
      ["Funiculaire", "Funiculaire"],
    ])(
      "labels physical mode %s as %s when there is no line code",
      async (physical_mode, category) => {
        const [train] = await trainsFor([passage({ info: { code: null, physical_mode } })]);

        expect(train?.category).toBe(category);
      },
    );

    it("has no category without a line code or physical mode", async () => {
      const [train] = await trainsFor([passage({ info: { code: "", physical_mode: null } })]);

      expect(train?.category).toBeNull();
    });

    it("uses the headsign as train number unless it just repeats the category", async () => {
      const trains = await trainsFor([
        passage({ info: { code: "B", headsign: "EJAN", trip_short_name: "123456" } }),
        // TER: headsign duplicates the line code, so the real train number is used.
        passage({ info: { code: "K13", headsign: "K13", trip_short_name: "884401" } }),
        passage({ info: { code: "", headsign: "", trip_short_name: "17" } }),
        passage({ info: { code: "", headsign: null, trip_short_name: "18" } }),
        passage({ info: { code: "", headsign: null, trip_short_name: null } }),
        passage({ info: { code: "K13", headsign: "K13", trip_short_name: null } }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual([
        "EJAN",
        "884401",
        "17",
        "18",
        "",
        "K13",
      ]);
    });

    it("trims the platform and treats blanks as missing", async () => {
      const trains = await trainsFor([
        passage({ stop_point: { platform_code: " 7 " } }),
        passage({ stop_point: { platform_code: "  " } }),
        passage({ stop_point: { platform_code: null } }),
        passage({ stop_point: {} }),
        passage(),
      ]);

      expect(trains.map((train) => train.platform)).toEqual(["7", null, null, null, null]);
    });

    it("preserves upstream order without sorting or limiting", async () => {
      const items = Array.from({ length: 30 }, (_, index) =>
        passage({
          info: { headsign: String(1000 + index), trip_short_name: String(1000 + index) },
          stop_date_time: {
            base_departure_date_time: `20260310T1${String(index % 6)}0000`,
            departure_date_time: `20260310T1${String(index % 6)}0000`,
          },
        }),
      );

      const trains = await trainsFor(items);

      expect(trains).toHaveLength(30);
      expect(trains[0]?.trainNumber).toBe("1000");
      expect(trains[29]?.trainNumber).toBe("1029");
    });

    it("returns an empty board when the response lacks the requested list", async () => {
      fetchMock.on(HOST, jsonResponse({ pagination: {} }));

      await expect(scrapeFranceTrains("FR686006", "arrivals", ENV)).resolves.toMatchObject({
        trains: [],
        info: null,
      });
    });
  });

  describe("rail filter", () => {
    it.each(["Bus", "Autocar", "Car", "Bike", "BikeSharingService"])(
      "drops %s passages",
      async (physical_mode) => {
        const trains = await trainsFor([
          passage({ info: { physical_mode, headsign: "9999", trip_short_name: "9999" } }),
          passage(),
        ]);

        expect(trains.map((train) => train.trainNumber)).toEqual(["6201"]);
      },
    );

    it("keeps passages without a physical mode", async () => {
      const trains = await trainsFor([passage({ info: { physical_mode: null } })]);

      expect(trains).toHaveLength(1);
    });
  });

  describe("delay", () => {
    const delayFor = async (base: string | undefined, realtime: string | undefined) => {
      const [train] = await trainsFor([
        passage({
          stop_date_time: { base_departure_date_time: base, departure_date_time: realtime },
        }),
      ]);
      return train?.delay;
    };

    it("is the positive difference in minutes", async () => {
      expect(await delayFor("20260310T101000", "20260310T102500")).toBe(15);
      expect(await delayFor("20260310T101000", "20260310T101030")).toBe(1);
      expect(await delayFor("20260310T101000", "20260310T101029")).toBeNull();
    });

    it("is null when on time or early", async () => {
      expect(await delayFor("20260310T101000", "20260310T101000")).toBeNull();
      expect(await delayFor("20260310T101000", "20260310T100500")).toBeNull();
    });

    it("is null when either timestamp is missing", async () => {
      expect(await delayFor(undefined, "20260310T101000")).toBeNull();
      expect(await delayFor("20260310T101000", undefined)).toBeNull();
    });

    it("handles delays that cross midnight", async () => {
      expect(await delayFor("20260310T235500", "20260311T000500")).toBe(10);
    });
  });

  describe("scheduled time", () => {
    it("uses the clock digits straight from the Navitia string", async () => {
      const trains = await trainsFor([
        passage({ stop_date_time: { base_departure_date_time: "20260310T000500" } }),
        passage({ stop_date_time: { base_departure_date_time: "20260310T2359" } }),
      ]);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["00:05", "23:59"]);
    });

    it("shows a placeholder when the time is missing or too short", async () => {
      const trains = await trainsFor([
        passage({ stop_date_time: {} }),
        passage({ stop_date_time: { base_departure_date_time: "20260310T10" } }),
      ]);

      expect(trains.map((train) => train.scheduledTime)).toEqual(["--:--", "--:--"]);
    });
  });

  describe("status", () => {
    const statusFor = async (
      realtime: string | undefined,
      type: "departures" | "arrivals" = "departures",
    ) => {
      const stop_date_time =
        type === "departures"
          ? { base_departure_date_time: "20260310T101000", departure_date_time: realtime }
          : { base_arrival_date_time: "20260310T101000", arrival_date_time: realtime };
      fetchMock.once(
        HOST,
        type === "departures"
          ? departures([passage({ stop_date_time })])
          : arrivals([passage({ stop_date_time })]),
      );
      const result = await scrapeFranceTrains("FR686006", type, ENV);
      return result.trains[0]?.status;
    };

    it("marks departures within five minutes of Paris now as departing, edges inclusive", async () => {
      expect(await statusFor("20260310T100500")).toBe("departing");
      expect(await statusFor("20260310T095500")).toBe("departing");
      expect(await statusFor("20260310T100000")).toBe("departing");
    });

    it("has no status just outside the window", async () => {
      expect(await statusFor("20260310T100501")).toBeNull();
      expect(await statusFor("20260310T095459")).toBeNull();
    });

    it("marks arrivals within the window as incoming", async () => {
      expect(await statusFor("20260310T100300", "arrivals")).toBe("incoming");
      expect(await statusFor("20260310T103000", "arrivals")).toBeNull();
    });

    it("has no status without a realtime timestamp", async () => {
      expect(await statusFor(undefined)).toBeNull();
    });

    it("is evaluated against Paris time, not UTC, in summer", async () => {
      freezeTime("2026-07-01T08:00:00.000Z"); // 10:00 CEST

      expect(await statusFor("20260701T100200")).toBe("departing");
      expect(await statusFor("20260701T080200")).toBeNull();
    });

    it("uses the realtime rather than the scheduled time", async () => {
      // Scheduled 10:10 is outside the window but the realtime 10:03 is inside it.
      fetchMock.once(
        HOST,
        departures([
          passage({
            stop_date_time: {
              base_departure_date_time: "20260310T101000",
              departure_date_time: "20260310T100300",
            },
          }),
        ]),
      );

      const { trains } = await scrapeFranceTrains("FR686006", "departures", ENV);

      expect(trains[0]?.status).toBe("departing");
    });
  });

  describe("disruptions", () => {
    const disruption = (id: string, effect: string, ...texts: string[]) => ({
      id,
      severity: { effect },
      messages: texts.map((text) => ({ text })),
    });

    it("marks trains with a NO_SERVICE disruption as cancelled and clears the delay", async () => {
      const [train] = await trainsFor(
        [
          passage({
            stop_date_time: {
              base_departure_date_time: "20260310T100200",
              departure_date_time: "20260310T101200",
            },
            links: [{ type: "disruption", id: "d1" }],
          }),
        ],
        [disruption("d1", "NO_SERVICE", "Train supprimé")],
      );

      expect(train).toMatchObject({ status: "cancelled", delay: null, info: "Train supprimé" });
    });

    it("finds disruption links on the display informations too", async () => {
      const [train] = await trainsFor(
        [passage({ info: { links: [{ type: "disruption", id: "d1" }] } })],
        [disruption("d1", "NO_SERVICE", "Grève")],
      );

      expect(train?.status).toBe("cancelled");
      expect(train?.info).toBe("Grève");
    });

    it("shows messages of non-cancelling disruptions without changing the status", async () => {
      const [train] = await trainsFor(
        [
          passage({
            stop_date_time: {
              base_departure_date_time: "20260310T100200",
              departure_date_time: "20260310T100700",
            },
            links: [{ type: "disruption", id: "d1" }],
          }),
        ],
        [disruption("d1", "SIGNIFICANT_DELAYS", "Retard dû à un incident")],
      );

      expect(train).toMatchObject({
        status: null, // 10:07 is two minutes outside the window
        delay: 5,
        info: "Retard dû à un incident",
      });
    });

    it("strips HTML from messages and joins several with semicolons", async () => {
      const [train] = await trainsFor(
        [
          passage({
            links: [
              { type: "disruption", id: "d1" },
              { type: "disruption", id: "d2" },
            ],
          }),
        ],
        [
          disruption("d1", "REDUCED_SERVICE", "<p>Travaux sur la <b>ligne</b></p>", "   "),
          disruption("d2", "DETOUR", "Déviation&nbsp;prévue"),
        ],
      );

      expect(train?.info).toBe("Travaux sur la ligne; Déviation&nbsp;prévue");
    });

    it("ignores unknown disruption ids and non-disruption links", async () => {
      const [train] = await trainsFor(
        [
          passage({
            links: [
              { type: "disruption", id: "missing" },
              { type: "line", id: "d1" },
            ],
          }),
        ],
        [disruption("d1", "NO_SERVICE", "Should not apply")],
      );

      expect(train).toMatchObject({ status: null, info: null });
    });

    it("tolerates disruptions without severity or messages", async () => {
      const [train] = await trainsFor(
        [passage({ links: [{ type: "disruption", id: "d1" }] })],
        [{ id: "d1" }],
      );

      expect(train).toMatchObject({ status: null, info: null });
    });

    it("applies disruptions to arrivals as well", async () => {
      fetchMock.on(
        HOST,
        arrivals(
          [passage({ links: [{ type: "disruption", id: "d1" }] })],
          [disruption("d1", "NO_SERVICE", "Supprimé")],
        ),
      );

      const { trains } = await scrapeFranceTrains("FR686006", "arrivals", ENV);

      expect(trains[0]).toMatchObject({ status: "cancelled", info: "Supprimé" });
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on(HOST, jsonResponse({ error: "down" }, { status: 503 }));

      const error = await scrapeFranceTrains("FR686006", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("French"),
        upstream: { host: HOST, status: 503 },
      });
    });

    it("reports a rejected API key as 401", async () => {
      fetchMock.on(HOST, jsonResponse({ error: "unauthorized" }, { status: 401 }));

      const error = await scrapeFranceTrains("FR686006", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("rejected our access"),
      });
    });

    it("reports an invalid JSON body as a 502", async () => {
      fetchMock.on(HOST, textResponse("<html>bad gateway</html>"));

      const error = await scrapeFranceTrains("FR686006", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("French") });
    });

    it("reports network failures as a 502", async () => {
      fetchMock.fail();

      const error = await scrapeFranceTrains("FR686006", "departures", ENV).catch(
        (error: unknown) => error,
      );

      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("French") });
    });
  });
});
