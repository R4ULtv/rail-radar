import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCountry } from "@repo/data/countries";
import { stationById } from "@repo/data/stations";
import { getProviderByStationId } from "../../src/analytics";
import { getScraperForStation, ScraperError } from "../../src/scrapers";
import { scrapeCzechTrains } from "../../src/scrapers/czech";
import { freezeTime, mockFetch, textResponse, type FetchMock } from "../helpers";
import { request } from "../helpers/app";

const BOARD = "/cestujici/infotabule?station=5453613";
const ID = "_tabule_WAR_szdc_boards_web_:tabsForm:tabview";

const cell = (content: string) =>
  `<td role="gridcell" class="table-row-odd"><span class="trainR">${content}</span></td>`;
const train = (service: string, brand: string) => {
  const [category, number] = service.split(" ");
  return `<td role="gridcell" class="table-row-odd"><span class="trainR">${category}</span> <span class="trainR">${number}</span> <span class="company">${brand}</span></td>`;
};
const tr = (cells: string) => `<tr data-ri="0" class="ui-widget-content" role="row">${cells}</tr>`;

function departure({
  time = "10:15",
  actual = "10:20",
  service = "EC 123",
  brand = "ČD",
  line = "Ex3",
  destination = "Brno hl.n.",
  via = "Česká Třebová – Svitavy",
  platform = "2",
} = {}) {
  return tr(
    cell(time) +
      cell(actual) +
      train(service, brand) +
      cell(line) +
      cell(destination) +
      cell(via) +
      cell(platform),
  );
}

function arrival({
  origin = "Praha hl.n.",
  line = "Ex3",
  time = "10:15",
  actual = "",
  service = "EC 123",
  brand = "ČD",
  platform = "2",
} = {}) {
  return tr(
    cell(origin) + cell(line) + cell(time) + cell(actual) + train(service, brand) + cell(platform),
  );
}

const notice = (text: string) =>
  tr(
    `<td role="gridcell" colspan="7" class="table-row-odd"><span class="table-cell-normal">${text}</span></td>`,
  );

function board(departures = departure(), arrivals = arrival()) {
  return `<html><body><label class="boards-name-label">Pardubice hlavní nádraží</label>
    <table><tbody id="${ID}:listDepartures_data" class="ui-datatable-data">${departures}</tbody></table>
    <table><tbody id="${ID}:listArrivals_data" class="ui-datatable-data">${arrivals}</tbody></table>
  </body></html>`;
}

describe("Czech station boards", () => {
  let fetchMock: FetchMock;
  beforeEach(() => {
    freezeTime("2026-03-10T09:00:00.000Z");
    fetchMock = mockFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the board by CIS code with a User-Agent and maps departure columns", async () => {
    fetchMock.on(BOARD, textResponse(board()));
    const result = await scrapeCzechTrains("CZ5453613");
    expect(fetchMock.requests).toHaveLength(1);
    expect(fetchMock.requests[0]?.url).toBe(
      "https://www.spravazeleznic.cz/cestujici/infotabule?station=5453613",
    );
    // Infotabule omits the board for requests without a User-Agent.
    expect(fetchMock.requests[0]?.headers.get("User-Agent")).toContain("RailRadar");
    expect(result.trains).toEqual([
      {
        brand: "ČD",
        category: "EC",
        trainNumber: "123",
        destination: "Brno hl.n.",
        scheduledTime: "10:15",
        delay: 5,
        platform: "2",
        status: null,
        info: "Line Ex3 · Via Česká Třebová – Svitavy",
      },
    ]);
    expect(result.info).toBeNull();
    expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
  });

  it("maps arrival columns, decodes entities and treats dashes as missing", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        board(
          departure(),
          arrival({
            origin: "Kol&#237;n &amp; okolí",
            service: "Os 5826",
            line: "–",
            platform: "–",
          }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613", "arrivals");
    expect(trains).toEqual([
      {
        brand: "ČD",
        category: "Os",
        trainNumber: "5826",
        origin: "Kolín & okolí",
        scheduledTime: "10:15",
        delay: 0,
        platform: null,
        status: null,
        info: null,
      },
    ]);
  });

  it("returns every row of a long board in order", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      departure({ time: `11:${String(i).padStart(2, "0")}`, actual: "", service: `Os ${100 + i}` }),
    );
    fetchMock.on(BOARD, textResponse(board(rows.join(""))));
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains).toHaveLength(30);
    expect(trains[29]).toMatchObject({ trainNumber: "129", scheduledTime: "11:29" });
  });

  it("calculates delays across midnight and clamps early trains", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        board(
          departure({ time: "23:58", actual: "00:08" }) +
            departure({ time: "00:15", actual: "00:13", service: "R 456" }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains.map((item) => [item.scheduledTime, item.delay])).toEqual([
      ["23:58", 10],
      ["00:15", 0],
    ]);
  });

  it("flags trains around the current time as departing or incoming", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        board(
          departure({ time: "10:02", actual: "" }),
          arrival({ time: "09:40", actual: "09:58" }),
        ),
      ),
    );
    expect((await scrapeCzechTrains("CZ5453613")).trains[0]?.status).toBe("departing");
    expect((await scrapeCzechTrains("CZ5453613", "arrivals")).trains[0]?.status).toBe("incoming");
  });

  it("keeps the platform and drops a missing track", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        board(
          departure({ platform: "1 / 3" }) +
            departure({ platform: "4 / –", service: "R 456" }) +
            departure({ platform: "5J", service: "R 789" }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains.map((item) => item.platform)).toEqual(["1 / 3", "4", "5J"]);
  });

  it("marks a train that does not run as cancelled and removes duplicate services", async () => {
    const cancelled = departure({ actual: "", via: "NEJEDE – NOT OPERATE" });
    fetchMock.on(BOARD, textResponse(board(cancelled + cancelled)));
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains).toHaveLength(1);
    expect(trains[0]).toMatchObject({ status: "cancelled", delay: null, info: "Line Ex3" });
  });

  it("attaches full-width disruption rows to their train instead of parsing them as services", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        board(
          departure({ via: "–" }) +
            notice("Vlak z důvodu v&#253;luky projíždí zastávku.") +
            departure({ service: "R 456", via: "–" }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains).toHaveLength(2);
    expect(trains[0]?.info).toBe("Line Ex3 · Vlak z důvodu výluky projíždí zastávku.");
    expect(trains[1]?.info).toBe("Line Ex3");
  });

  it("accepts an empty board, including PrimeFaces' placeholder row", async () => {
    const placeholder =
      '<tr class="ui-widget-content ui-datatable-empty-message"><td colspan="7">No records found.</td></tr>';
    fetchMock.on(BOARD, textResponse(board("", placeholder)));
    await expect(scrapeCzechTrains("CZ5453613")).resolves.toMatchObject({ trains: [], info: null });
    await expect(scrapeCzechTrains("CZ5453613", "arrivals")).resolves.toMatchObject({
      trains: [],
    });
  });

  it("returns an empty board with a note for a station without electronic information", async () => {
    fetchMock.on(
      BOARD,
      textResponse(
        "<html><body>Omlouváme se, v současné době nejsou v této stanici k dispozici elektronické informace pro cestující</body></html>",
      ),
    );
    const result = await scrapeCzechTrains("CZ5453613");
    expect(result.trains).toEqual([]);
    expect(result.info).toContain("no live board");
  });

  it.each([
    // The page without its board, as served to requests with no User-Agent.
    "<html><title>Infotabule</title></html>",
    board(tr(cell("Changed layout"))),
  ])("rejects an invalid board instead of returning a false empty result", async (html) => {
    fetchMock.on(BOARD, textResponse(html));
    await expect(scrapeCzechTrains("CZ5453613")).rejects.toMatchObject({
      statusCode: 502,
      timing: { fetchMs: expect.any(Number) },
    });
  });

  it("rejects malformed identities before fetching", async () => {
    await expect(scrapeCzechTrains("CZ123")).rejects.toBeInstanceOf(ScraperError);
    await expect(scrapeCzechTrains("CZ9999999")).rejects.toMatchObject({ statusCode: 404 });
    expect(fetchMock.requests).toHaveLength(0);
  });

  it.each(["arrivals", "departures"] as const)(
    "serves %s through the full API route",
    async (type) => {
      fetchMock.on(BOARD, textResponse(board()));
      const { response } = await request(`/stations/CZ5453613?type=${type}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ trains: [{ trainNumber: "123" }] });
      expect(getCountry("CZ5453613")).toBe("cz");
      expect(getProviderByStationId("CZ5453613")).toBe("spravazeleznic");
      expect(getScraperForStation("CZ5453613")).toBe(scrapeCzechTrains);
    },
  );

  it("makes canonical Czech stations searchable", async () => {
    const { response } = await request("/stations/search?q=pardubice");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "CZ5453613", name: "Pardubice hlavní nádraží" }),
      ]),
    );
    expect(stationById.get("CZ5457076")?.geo).toEqual({ lat: 50.08309, lng: 14.435978 });
  });
});
