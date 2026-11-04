import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ieStationCodes from "../../src/scrapers/codes/ie-codes.json";
import { ScraperError } from "../../src/scrapers/core";
import { scrapeIrelandTrains } from "../../src/scrapers/ireland";
import { freezeTime, jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

const NOW = "2026-03-10T09:00:00.000Z";

type Row = {
  Traincode: string;
  Origin: string;
  Destination: string;
  Status: string;
  Duein: string;
  Late: string;
  Scharrival: string;
  Schdepart: string;
  Traintype: string;
  Locationtype: string;
};

function record(overrides: Partial<Row> = {}): Row {
  return {
    Traincode: "E109",
    Origin: "Dublin Heuston",
    Destination: "Cork",
    Status: "En Route",
    Duein: "30",
    Late: "0",
    Scharrival: "10:30",
    Schdepart: "10:35",
    Traintype: "Intercity",
    Locationtype: "S",
    ...overrides,
  };
}

function xmlRecord(fields: Row): string {
  const body = Object.entries({
    Servertime: "2026-03-10T09:00:00.000",
    Stationfullname: "Cork",
    Stationcode: "CORK",
    ...fields,
    Direction: "Southbound",
  })
    .map(([tag, value]) => `<${tag}>${value}</${tag}>`)
    .join("");
  return `<objStationData>${body}</objStationData>`;
}

function xml(...records: Row[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<ArrayOfObjStationData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://api.irishrail.ie/realtime/">
${records.map(xmlRecord).join("\n")}
</ArrayOfObjStationData>`;
}

describe("scrapeIrelandTrains", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    freezeTime(NOW);
    fetchMock = mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the station board using the code mapped from the numeric station id", async () => {
    fetchMock.on("api.irishrail.ie", textResponse(xml()));

    await scrapeIrelandTrains("IE30", "departures");

    expect((ieStationCodes as { [id: string]: string })["30"]).toBe("CORK");
    expect(fetchMock.requests).toHaveLength(1);
    expect(fetchMock.requests[0]?.url).toBe(
      "https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML_WithNumMins?StationCode=CORK&NumMins=90",
    );
  });

  it("uses the same request for arrivals", async () => {
    fetchMock.on("api.irishrail.ie", textResponse(xml()));

    await scrapeIrelandTrains("IE1", "arrivals");

    expect(fetchMock.url().searchParams.get("StationCode")).toBe("HSTON");
  });

  it("rejects unknown station ids without calling the upstream", async () => {
    const error = await scrapeIrelandTrains("IE999999").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({ statusCode: 400, message: "Unknown Irish station ID: IE999999" });
    expect(fetchMock.requests).toHaveLength(0);
  });

  it("maps a departure to a train", async () => {
    fetchMock.on(
      "api.irishrail.ie",
      textResponse(xml(record({ Late: "4", Status: "En Route", Duein: "3", Schdepart: "10:35" }))),
    );

    const result = await scrapeIrelandTrains("IE30", "departures");

    expect(result.info).toBeNull();
    expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
    expect(result.trains).toEqual([
      {
        brand: "IR",
        category: "IC",
        trainNumber: "E109",
        destination: "Cork",
        scheduledTime: "10:35",
        delay: 4,
        platform: null,
        status: "departing",
        info: null,
      },
    ]);
  });

  it("maps an arrival to a train using the origin", async () => {
    fetchMock.on(
      "api.irishrail.ie",
      textResponse(xml(record({ Locationtype: "D", Duein: "2", Status: "Arriving" }))),
    );

    const result = await scrapeIrelandTrains("IE30", "arrivals");

    expect(result.trains).toEqual([
      {
        brand: "IR",
        category: "IC",
        trainNumber: "E109",
        origin: "Dublin Heuston",
        scheduledTime: "10:30",
        delay: 0,
        platform: null,
        status: "incoming",
        info: null,
      },
    ]);
    expect(result.trains[0]).not.toHaveProperty("destination");
  });

  it("filters records by location type for each board", async () => {
    const body = xml(
      record({ Traincode: "ORIG", Locationtype: "O" }),
      record({ Traincode: "THRU", Locationtype: "S" }),
      record({ Traincode: "TERM", Locationtype: "D" }),
    );
    fetchMock.on("api.irishrail.ie", textResponse(body));

    const departures = await scrapeIrelandTrains("IE30", "departures");
    const arrivals = await scrapeIrelandTrains("IE30", "arrivals");

    expect(departures.trains.map((train) => train.trainNumber).sort()).toEqual(["ORIG", "THRU"]);
    expect(arrivals.trains.map((train) => train.trainNumber).sort()).toEqual(["TERM", "THRU"]);
  });

  describe("scheduled time", () => {
    it("treats 00:00 as not applicable and falls back to the other time", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            record({ Traincode: "A", Locationtype: "O", Scharrival: "00:00", Schdepart: "11:00" }),
            record({ Traincode: "B", Locationtype: "D", Scharrival: "11:30", Schdepart: "00:00" }),
          ),
        ),
      );

      const departures = await scrapeIrelandTrains("IE30", "departures");
      const arrivals = await scrapeIrelandTrains("IE30", "arrivals");

      expect(departures.trains[0]?.scheduledTime).toBe("11:00");
      expect(arrivals.trains[0]?.scheduledTime).toBe("11:30");
    });

    it("falls back to the arrival time for a departure with no departure time", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(xml(record({ Schdepart: "00:00", Scharrival: "12:15" }))),
      );

      const [train] = (await scrapeIrelandTrains("IE30", "departures")).trains;

      expect(train?.scheduledTime).toBe("12:15");
    });

    it("shows --:-- when the upstream sends no time", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(xml(record({ Schdepart: "", Scharrival: "" }))),
      );

      const [train] = (await scrapeIrelandTrains("IE30", "departures")).trains;

      expect(train?.scheduledTime).toBe("--:--");
    });
  });

  describe("delay", () => {
    it("clamps early trains to zero and reports late ones", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            record({ Traincode: "A", Late: "-3" }),
            record({ Traincode: "B", Late: "0" }),
            record({ Traincode: "C", Late: "12" }),
          ),
        ),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => train.delay)).toEqual([0, 0, 12]);
    });

    it("is null when the delay is missing or not a number", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(record({ Traincode: "A", Late: "" }), record({ Traincode: "B", Late: "n/a" })),
        ),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => train.delay)).toEqual([null, null]);
    });
  });

  describe("status", () => {
    async function statuses(
      type: "arrivals" | "departures",
      ...overrides: Partial<Row>[]
    ): Promise<unknown[]> {
      const locationtype = type === "arrivals" ? "D" : "O";
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            ...overrides.map((override, index) =>
              record({ Traincode: `T${index}`, Locationtype: locationtype, ...override }),
            ),
          ),
        ),
      );
      return (await scrapeIrelandTrains("IE30", type)).trains.map((train) => train.status);
    }

    it("is departing for en-route or arriving trains due within 5 minutes", async () => {
      expect(
        await statuses(
          "departures",
          { Status: "En Route", Duein: "5" },
          { Status: "Arriving", Duein: "0" },
          { Status: "EN ROUTE", Duein: "1" },
        ),
      ).toEqual(["departing", "departing", "departing"]);
    });

    it("is incoming for arrivals", async () => {
      expect(await statuses("arrivals", { Status: "En Route", Duein: "2" })).toEqual(["incoming"]);
    });

    it("is null when the train is due later, or its status or due time is unusable", async () => {
      expect(
        await statuses(
          "departures",
          { Status: "En Route", Duein: "6" },
          { Status: "Not yet departed", Duein: "1" },
          { Status: "En Route", Duein: "" },
          { Status: "", Duein: "2" },
        ),
      ).toEqual([null, null, null, null]);
    });
  });

  describe("category", () => {
    it("maps Train and Intercity to IC and keeps other types", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            record({ Traincode: "A", Traintype: "Train" }),
            record({ Traincode: "B", Traintype: "intercity" }),
            record({ Traincode: "C", Traintype: "DART" }),
            record({ Traincode: "D", Traintype: "Commuter" }),
            record({ Traincode: "E", Traintype: "" }),
          ),
        ),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => train.category)).toEqual(["IC", "IC", "DART", "Commuter", null]);
    });
  });

  describe("board assembly", () => {
    it("skips records without a train code", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(xml(record({ Traincode: "" }), record({ Traincode: "  P801 " }))),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => train.trainNumber)).toEqual(["P801"]);
    });

    it("sorts by scheduled time", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            record({ Traincode: "C", Schdepart: "12:00" }),
            record({ Traincode: "A", Schdepart: "10:05" }),
            record({ Traincode: "B", Schdepart: "11:30" }),
          ),
        ),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => train.trainNumber)).toEqual(["A", "B", "C"]);
    });

    it("keeps only the earliest record per train number", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          xml(
            record({ Traincode: "A", Schdepart: "13:00" }),
            record({ Traincode: "A", Schdepart: "10:00" }),
            record({ Traincode: "B", Schdepart: "11:00" }),
          ),
        ),
      );

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains.map((train) => [train.trainNumber, train.scheduledTime])).toEqual([
        ["A", "10:00"],
        ["B", "11:00"],
      ]);
    });

    it("limits the board to 16 trains", async () => {
      const records = Array.from({ length: 20 }, (_, index) =>
        record({ Traincode: `T${index}`, Schdepart: `1${index % 10}:00` }),
      );
      fetchMock.on("api.irishrail.ie", textResponse(xml(...records)));

      const { trains } = await scrapeIrelandTrains("IE30");

      expect(trains).toHaveLength(16);
    });

    it("returns an empty board when the upstream lists no trains", async () => {
      fetchMock.on(
        "api.irishrail.ie",
        textResponse(
          `<?xml version="1.0"?><ArrayOfObjStationData xmlns="http://api.irishrail.ie/realtime/" />`,
        ),
      );

      await expect(scrapeIrelandTrains("IE30")).resolves.toMatchObject({ trains: [], info: null });
    });
  });

  it("throws a bad gateway error when the response is not the expected XML", async () => {
    fetchMock.on("api.irishrail.ie", textResponse("<html>Maintenance</html>"));

    const error = await scrapeIrelandTrains("IE30").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({
      statusCode: 502,
      message: "Invalid response from Irish Rail API.",
    });
  });

  it("wraps upstream HTTP errors in a ScraperError", async () => {
    fetchMock.on("api.irishrail.ie", jsonResponse({}, { status: 500 }));

    const error = await scrapeIrelandTrains("IE30").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toMatchObject({
      statusCode: 500,
      message: expect.stringContaining("Irish"),
      upstream: { host: "api.irishrail.ie", status: 500 },
    });
  });

  it("wraps network failures in a ScraperError", async () => {
    fetchMock.fail();

    await expect(scrapeIrelandTrains("IE30")).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("Irish"),
    });
  });
});
