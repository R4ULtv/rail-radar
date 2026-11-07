import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCountry } from "@repo/data/countries";
import { stationById } from "@repo/data/stations";
import { getProviderByStationId } from "../../src/analytics";
import { getScraperForStation, ScraperError } from "../../src/scrapers";
import { scrapeCzechTrains } from "../../src/scrapers/czech";
import { freezeTime, mockFetch, textResponse, type FetchMock } from "../helpers";
import { request } from "../helpers/app";

const HOME = '<input type="hidden" id="token" value="ABC123" />';
const SESSION = { headers: { "Set-Cookie": "ASP.NET_SessionId=session-one; path=/; HttpOnly" } };

function row({
  direction = "Brno hl.n.",
  time = "10:15",
  actual = "10:20",
  service = "EC 123",
  brand = "ČD",
  platform = "2",
  line = "Ex3",
  type = "departures",
  via = "",
} = {}) {
  const values =
    type === "arrivals"
      ? [
          direction,
          "mobile time",
          "mobile service",
          line,
          time,
          actual,
          `${service} <span class="colorGray">${brand}</span>`,
          platform,
        ]
      : [
          "mobile time",
          "mobile service",
          "mobile destination",
          time,
          actual,
          `${service} <span class="colorGray">${brand}</span>`,
          line,
          direction,
          via,
          platform,
        ];
  return `<div class="row dataGridst bgWhite">${values.map((value) => `<div class="col-lg-2"><b>${value}</b></div>`).join("")}</div>`;
}

function board(arrivals = row({ type: "arrivals", direction: "Praha hl.n." }), departures = row()) {
  return `<div id="stationArrival" style="display:none">${arrivals}</div><div id="stationDeparture">${departures}</div>`;
}

describe("Czech GRAPP boards", () => {
  let fetchMock: FetchMock;
  beforeEach(() => {
    freezeTime("2026-03-10T09:00:00.000Z");
    fetchMock = mockFetch();
    fetchMock.on((url) => url === "https://grapp.spravazeleznic.cz/", textResponse(HOME, SESSION));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the token and session cookie from the same homepage and maps desktop departure columns", async () => {
    fetchMock.on("/OneTrain/StationInfo/ABC123?stationId=3223", textResponse(board()));
    const result = await scrapeCzechTrains("CZ5453613");
    expect(fetchMock.requests).toHaveLength(2);
    expect(fetchMock.requests[1]?.headers.get("Cookie")).toBe("ASP.NET_SessionId=session-one");
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
        info: "Line Ex3",
      },
    ]);
    expect(result.info).toContain("next hour");
    expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
  });

  it("selects arrivals even when the section is hidden and decodes Czech entities", async () => {
    fetchMock.on(
      "/OneTrain/StationInfo/",
      textResponse(
        board(
          row({
            type: "arrivals",
            direction: "Kol&#237;n &amp; okolí",
            service: "Os 5826",
            actual: "",
            platform: "-",
          }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613", "arrivals");
    expect(trains).toHaveLength(1);
    expect(trains[0]).toMatchObject({
      origin: "Kolín & okolí",
      trainNumber: "5826",
      category: "Os",
      delay: 0,
      platform: null,
    });
    expect(trains[0]).not.toHaveProperty("destination");
  });

  it("calculates delays across midnight, clamps early trains and preserves board order", async () => {
    fetchMock.on(
      "/OneTrain/StationInfo/",
      textResponse(
        board(
          "",
          row({ time: "23:58", actual: "00:08" }) +
            row({ time: "00:15", actual: "00:13", service: "R 456" }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains.map((train) => [train.scheduledTime, train.delay])).toEqual([
      ["23:58", 10],
      ["00:15", 0],
    ]);
  });

  it("keeps departure destinations separate from intermediate stops and omits placeholder lines", async () => {
    fetchMock.on(
      "/OneTrain/StationInfo/",
      textResponse(
        board(
          "",
          row({
            direction: "Gdynia Glowna",
            via: "Lichkov - Wroclaw Glowny",
            line: "-",
          }),
        ),
      ),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains[0]).toMatchObject({
      destination: "Gdynia Glowna",
      info: "Via Lichkov - Wroclaw Glowny",
    });
  });

  it("handles cancellations and removes duplicate services", async () => {
    const cancelled = row({ actual: "Odřeknut" });
    fetchMock.on("/OneTrain/StationInfo/", textResponse(board("", cancelled + cancelled)));
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains).toHaveLength(1);
    expect(trains[0]).toMatchObject({ status: "cancelled", delay: null });
  });

  it("accepts a valid empty board", async () => {
    fetchMock.on("/OneTrain/StationInfo/", textResponse(board("", "")));
    await expect(scrapeCzechTrains("CZ5453613")).resolves.toMatchObject({ trains: [] });
  });

  it("attaches full-width disruption rows to their train instead of parsing them as services", async () => {
    const notice =
      '<div class="row dataGridst bgWhite"><div class="col-lg-12 col-md-12">Vlak z důvodu v&#253;luky projíždí zastávku.</div></div>';
    fetchMock.on(
      "/OneTrain/StationInfo/",
      textResponse(board("", row() + notice + row({ service: "R 456" }))),
    );
    const { trains } = await scrapeCzechTrains("CZ5453613");
    expect(trains).toHaveLength(2);
    expect(trains[0]?.info).toBe("Line Ex3 · Vlak z důvodu výluky projíždí zastávku.");
    expect(trains[1]?.info).toBe("Line Ex3");
  });

  it.each([
    "<html>Session expired</html>",
    board("", '<div class="dataGridst"><div>Changed layout</div></div>'),
  ])("rejects an invalid board instead of returning a false empty result", async (html) => {
    fetchMock.on("/OneTrain/StationInfo/", textResponse(html));
    await expect(scrapeCzechTrains("CZ5453613")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("does not send a follow-up request if the session cookie is missing", async () => {
    fetchMock.fetch.mockResolvedValueOnce(textResponse(HOME));
    await expect(scrapeCzechTrains("CZ5453613")).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchMock.requests).toHaveLength(0);
    expect(fetchMock.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not reuse sessions between requests", async () => {
    fetchMock.on("/OneTrain/StationInfo/", textResponse(board()));
    await scrapeCzechTrains("CZ5453613");
    await scrapeCzechTrains("CZ5453613", "arrivals");
    expect(fetchMock.requests.map(({ url }) => new URL(url).pathname)).toEqual([
      "/",
      "/OneTrain/StationInfo/ABC123",
      "/",
      "/OneTrain/StationInfo/ABC123",
    ]);
  });

  it("rejects unknown identities before fetching", async () => {
    await expect(scrapeCzechTrains("CZ9999999")).rejects.toBeInstanceOf(ScraperError);
    expect(fetchMock.requests).toHaveLength(0);
  });

  it.each(["arrivals", "departures"] as const)(
    "serves %s through the full API route",
    async (type) => {
      fetchMock.on("/OneTrain/StationInfo/", textResponse(board()));
      const { response } = await request(`/stations/CZ5453613?type=${type}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ trains: [{ trainNumber: "123" }] });
      expect(getCountry("CZ5453613")).toBe("cz");
      expect(getProviderByStationId("CZ5453613")).toBe("grapp");
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
