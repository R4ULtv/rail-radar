import { beforeEach, describe, expect, it } from "vitest";

import { ScraperError } from "../../src/scrapers/core";
import { scrapeTrains } from "../../src/scrapers/italy";
import { jsonResponse, mockFetch, textResponse, type FetchMock } from "../helpers";

// Only the leading bytes of these data URIs are compared by the scraper.
const REGIONALE_LOGO_A = "data:image/gif;base64,R0lGODlhtQApAOeYAFaxMleyM1+xM2Cy" + "AAAA";
const REGIONALE_LOGO_B = "data:image/gif;base64,R0lGODlhuAApAOeXAE5QTU9RTlFTUFRW" + "AAAA";
const TRENITALIA_LOGO = "data:image/gif;base64,R0lGODlhZAApAOeAAOkYIP4";

type RowOptions = {
  brandAlt?: string | null;
  brandSrc?: string;
  categoryAlt?: string | null;
  categoryText?: string;
  number?: string;
  place?: string;
  time?: string;
  delay?: string;
  platform?: string;
  statusImg?: string | null;
  info?: string;
};

function row(options: RowOptions = {}): string {
  const {
    brandAlt = "TRENITALIA",
    brandSrc = TRENITALIA_LOGO,
    categoryAlt = "Categoria ALTA VELOCITA'",
    categoryText = "",
    number = "9615",
    place = "MILANO CENTRALE",
    time = "10:25",
    delay = "",
    platform = "7",
    statusImg = null,
    info = "",
  } = options;

  const brand = brandAlt === null ? "" : `<img alt="${brandAlt}" src="${brandSrc}" />`;
  const category =
    categoryAlt === null ? "" : `<img alt="${categoryAlt}" src="data:image/gif;base64,AAAA" />`;
  const status = statusImg === null ? "" : `<img src="${statusImg}" alt="" />`;

  return `
    <tr>
      <td>${brand}</td>
      <td>${category}${categoryText}</td>
      <td>${number}</td>
      <td>${place}</td>
      <td>${time}</td>
      <td>${delay}</td>
      <td>${platform}</td>
      <td>${status}</td>
      <td><div class="testoinfoaggiuntive">${info}</div></td>
    </tr>`;
}

function page(rows: string[], stationInfo?: string): string {
  return `<!DOCTYPE html>
  <html><body>
    <div class="barrainfostazione"><div class="marqueeinfosupp">${stationInfo ?? ""}</div></div>
    <table id="monitor">
      <thead><tr><th>Brand</th><th>Category</th><th>Train</th><th>To</th><th>Time</th><th>Delay</th><th>Platform</th><th></th><th>Info</th></tr></thead>
      <tbody>${rows.join("\n")}</tbody>
    </table>
  </body></html>`;
}

describe("scrapeTrains (Italy)", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  const scrape = async (
    rows: string[],
    type: "departures" | "arrivals" = "departures",
    stationInfo?: string,
  ) => {
    fetchMock.once("iechub.rfi.it", textResponse(page(rows, stationInfo)));
    return scrapeTrains("IT1728", type);
  };

  const trainsOf = async (options: RowOptions) => (await scrape([row(options)])).trains[0];

  describe("request", () => {
    it("requests the departures monitor for the numeric place id", async () => {
      fetchMock.on("iechub.rfi.it", textResponse(page([])));

      await scrapeTrains("IT1728", "departures");

      expect(fetchMock.requests[0]?.url).toBe(
        "https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor?Arrivals=False&Search=&PlaceId=1728",
      );
    });

    it("requests the arrivals monitor when asked", async () => {
      fetchMock.on("iechub.rfi.it", textResponse(page([])));

      await scrapeTrains("IT1728", "arrivals");

      expect(fetchMock.requests[0]?.url).toBe(
        "https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor?placeId=1728&arrivals=True",
      );
    });

    it("defaults to departures", async () => {
      fetchMock.on("iechub.rfi.it", textResponse(page([])));

      await scrapeTrains("IT2416");

      expect(fetchMock.url().searchParams.get("Arrivals")).toBe("False");
      expect(fetchMock.url().searchParams.get("PlaceId")).toBe("2416");
    });
  });

  describe("mapping", () => {
    it("maps a departure row to a train", async () => {
      const result = await scrape([
        row({
          delay: "5",
          platform: "12",
          statusImg: "/images/LampeggioGold.gif",
          info: "STOPS AT: BOLOGNA CENTRALE, FIRENZE S.M.N.",
        }),
      ]);

      expect(result.info).toBeNull();
      expect(result.timing.fetchMs).toBeGreaterThanOrEqual(0);
      expect(result.trains).toEqual([
        {
          brand: "TRENITALIA",
          category: "AV",
          trainNumber: "9615",
          destination: "MILANO CENTRALE",
          scheduledTime: "10:25",
          delay: 5,
          platform: "12",
          status: "departing",
          info: "BOLOGNA CENTRALE, FIRENZE S.M.N.",
        },
      ]);
    });

    it("maps an arrival row using the origin and incoming status", async () => {
      const result = await scrape(
        [
          row({
            brandAlt: "ITALO",
            categoryAlt: "Categoria INTERCITY",
            number: "8905",
            place: "NAPOLI CENTRALE",
            delay: "On time",
            statusImg: "/images/LampeggioGrey.gif",
          }),
        ],
        "arrivals",
      );

      expect(result.trains).toEqual([
        {
          brand: "ITALO",
          category: "IC",
          trainNumber: "8905",
          origin: "NAPOLI CENTRALE",
          scheduledTime: "10:25",
          delay: 0,
          platform: "7",
          status: "incoming",
          info: null,
        },
      ]);
      expect(result.trains[0]).not.toHaveProperty("destination");
    });

    it("keeps the board order and parses every row, including the last", async () => {
      const { trains } = await scrape([
        row({ number: "1" }),
        row({ number: "2" }),
        row({ number: "3" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["1", "2", "3"]);
    });

    it("does not leak state between rows", async () => {
      const { trains } = await scrape([
        row({
          number: "1",
          delay: "20",
          platform: "3",
          statusImg: "/x/LampeggioGold.gif",
          info: "SOME NOTICE",
        }),
        row({
          number: "2",
          delay: "",
          platform: "",
          statusImg: null,
          info: "",
          brandAlt: null,
          categoryAlt: null,
        }),
      ]);

      expect(trains[1]).toEqual({
        brand: null,
        category: null,
        trainNumber: "2",
        destination: "MILANO CENTRALE",
        scheduledTime: "10:25",
        delay: 0,
        platform: null,
        status: null,
        info: null,
      });
    });

    it("skips rows without a train number", async () => {
      const { trains } = await scrape([
        row({ number: "" }),
        row({ number: "  " }),
        row({ number: "77" }),
      ]);

      expect(trains.map((train) => train.trainNumber)).toEqual(["77"]);
    });

    it("fills defaults for rows with missing trailing cells", async () => {
      fetchMock.once(
        "iechub.rfi.it",
        textResponse(
          page([`<tr><td></td><td></td><td>5555</td><td>BARI CENTRALE</td><td>11:11</td></tr>`]),
        ),
      );

      const { trains } = await scrapeTrains("IT1728");

      expect(trains).toEqual([
        {
          brand: null,
          category: null,
          trainNumber: "5555",
          destination: "BARI CENTRALE",
          scheduledTime: "11:11",
          delay: null,
          platform: null,
          status: null,
          info: null,
        },
      ]);
    });

    it("leaves destination and time empty when those cells are missing", async () => {
      fetchMock.once(
        "iechub.rfi.it",
        textResponse(page([`<tr><td></td><td></td><td>42</td></tr>`])),
      );

      const { trains } = await scrapeTrains("IT1728");

      expect(trains[0]).toMatchObject({
        trainNumber: "42",
        destination: "",
        scheduledTime: "",
        delay: null,
      });
    });

    it("returns an empty board when the page has no rows", async () => {
      await expect(scrape([])).resolves.toMatchObject({ trains: [], info: null });
    });

    it("ignores header rows outside the table body", async () => {
      const { trains } = await scrape([row({ number: "10" })]);

      expect(trains).toHaveLength(1);
    });

    it("decodes entities and collapses repeated apostrophes in places", async () => {
      const trains = (
        await scrape([
          row({ number: "1", place: "PONTE D''''ADDA" }),
          row({ number: "2", place: "SANT&#39;ANTIMO" }),
          row({ number: "3", place: "TORRE &amp; CASTELLO" }),
          row({ number: "4", place: "S.&nbsp;MARIA &#x4E; &lt;X&gt; &quot;Q&quot; &apos;A&apos;" }),
        ])
      ).trains;

      expect(trains.map((train) => train.destination)).toEqual([
        "PONTE D'ADDA",
        "SANT'ANTIMO",
        "TORRE & CASTELLO",
        "S. MARIA N <X> \"Q\" 'A'",
      ]);
    });
  });

  describe("brand", () => {
    it("takes the brand from the logo alt text", async () => {
      expect((await trainsOf({ brandAlt: "TRENORD" }))?.brand).toBe("TRENORD");
    });

    it("has no brand without a logo", async () => {
      expect((await trainsOf({ brandAlt: null }))?.brand).toBeNull();
    });

    it("distinguishes the Regionale logos that RFI also labels TRENITALIA", async () => {
      expect((await trainsOf({ brandSrc: REGIONALE_LOGO_A }))?.brand).toBe("REGIONALE");
      expect((await trainsOf({ brandSrc: REGIONALE_LOGO_B }))?.brand).toBe("REGIONALE");
      expect((await trainsOf({ brandAlt: "trenitalia", brandSrc: REGIONALE_LOGO_A }))?.brand).toBe(
        "REGIONALE",
      );
    });

    it("keeps the Trenitalia brand for other logos and non-Trenitalia alts", async () => {
      expect((await trainsOf({ brandSrc: TRENITALIA_LOGO }))?.brand).toBe("TRENITALIA");
      expect((await trainsOf({ brandAlt: "TRENORD", brandSrc: REGIONALE_LOGO_A }))?.brand).toBe(
        "TRENORD",
      );
    });
  });

  describe("category", () => {
    it.each([
      ["Categoria ALTA VELOCITA'", "AV"],
      ["Categoria ALTA VELOCITA&#39;", "AV"],
      ["Categoria Alta Velocità", "AV"],
      ["Categoria ALTA VELOCITÀ’", "AV"],
      ["Categoria ALTA VELOCIT&agrave;", "AV"],
      ["Categoria ALTA VELOCIT&Agrave;", "AV"],
      ["Categoria PERCORSO CITT&agrave;", "PERCORSO CITTà"],
      ["Categoria INTERCITY", "IC"],
      ["Categoria Intercity Notte", "ICN"],
      ["Categoria INTERCITY   NOTTE", "ICN"],
      ["Categoria REGIONALE", "REG"],
      ["Categoria Regionale Veloce", "RV"],
      ["Categoria EUROCITY", "EUROCITY"],
      ["ESPRESSO", "ESPRESSO"],
    ])("normalizes %j to %s", async (categoryAlt, category) => {
      expect((await trainsOf({ categoryAlt }))?.category).toBe(category);
    });

    it("falls back to the cell text when there is no image", async () => {
      expect((await trainsOf({ categoryAlt: null, categoryText: "REGIONALE" }))?.category).toBe(
        "REG",
      );
      expect(
        (await trainsOf({ categoryAlt: null, categoryText: "Categoria Intercity" }))?.category,
      ).toBe("IC");
    });

    it("is null when the cell is empty or only a prefix", async () => {
      expect((await trainsOf({ categoryAlt: null }))?.category).toBeNull();
      expect((await trainsOf({ categoryAlt: "Categoria " }))?.category).toBeNull();
    });
  });

  describe("delay and status", () => {
    it.each([
      ["", 0],
      ["   ", 0],
      ["On time", 0],
      ["ON TIME", 0],
      ["7", 7],
      [" 12 ", 12],
      ["45 min", 45],
      ["???", null],
    ])("parses delay text %j as %s", async (delay, expected) => {
      expect((await trainsOf({ delay }))?.delay).toBe(expected);
    });

    it("marks Cancelled rows as cancelled with no delay", async () => {
      expect(await trainsOf({ delay: "Cancelled" })).toMatchObject({
        delay: null,
        status: "cancelled",
      });
      expect(await trainsOf({ delay: "cancelled" })).toMatchObject({
        delay: null,
        status: "cancelled",
      });
    });

    it("cancellation overrides a flashing status", async () => {
      expect(
        (await trainsOf({ delay: "Cancelled", statusImg: "/img/LampeggioGold.gif" }))?.status,
      ).toBe("cancelled");
    });

    it("marks trains whose info says CANCELLATO as cancelled", async () => {
      const train = await trainsOf({ info: "Treno Cancellato", delay: "10" });

      expect(train).toMatchObject({ status: "cancelled", delay: 10, info: "Treno Cancellato" });
    });

    it("recognises both flashing icons and ignores other icons", async () => {
      expect((await trainsOf({ statusImg: "/img/LampeggioGold.gif" }))?.status).toBe("departing");
      expect((await trainsOf({ statusImg: "/img/LampeggioGrey.gif" }))?.status).toBe("departing");
      expect((await trainsOf({ statusImg: "/img/Fermo.gif" }))?.status).toBeNull();
      expect((await trainsOf({ statusImg: null }))?.status).toBeNull();
    });
  });

  describe("platform", () => {
    it("trims the platform text and nulls blanks", async () => {
      expect((await trainsOf({ platform: "  12 " }))?.platform).toBe("12");
      expect((await trainsOf({ platform: "" }))?.platform).toBeNull();
      expect((await trainsOf({ platform: "&nbsp;" }))?.platform).toBeNull();
    });
  });

  describe("train info", () => {
    it("extracts the stop list after STOPS AT", async () => {
      expect((await trainsOf({ info: "Note: STOPS AT:  ROMA TERMINI, NAPOLI C.LE " }))?.info).toBe(
        "ROMA TERMINI, NAPOLI C.LE",
      );
      expect((await trainsOf({ info: "stops at: LECCE" }))?.info).toBe("LECCE");
    });

    it("keeps other notices as they are, decoded", async () => {
      expect((await trainsOf({ info: "  Ritardo per guasto all&#39;infrastruttura " }))?.info).toBe(
        "Ritardo per guasto all'infrastruttura",
      );
    });

    it("is null for empty notices", async () => {
      expect((await trainsOf({ info: "" }))?.info).toBeNull();
      expect((await trainsOf({ info: "  &nbsp; " }))?.info).toBeNull();
    });
  });

  describe("station info", () => {
    it("returns the station notice", async () => {
      const result = await scrape([row()], "departures", "LAVORI IN CORSO SUL BINARIO 3");

      expect(result.info).toBe("LAVORI IN CORSO SUL BINARIO 3");
    });

    it("drops the English translation RFI appends after a slash", async () => {
      const result = await scrape(
        [],
        "departures",
        "SCIOPERO DAL 10 AL 11 MARZO / FROM 10 TO 11 MARCH TRAINS MAY BE CANCELLED",
      );

      expect(result.info).toBe("SCIOPERO DAL 10 AL 11 MARZO");
    });

    it.each([
      "DUE TO",
      "THE",
      "TRAINS",
      "SERVICES",
      "PLEASE",
      "FOR",
      "UNTIL",
      "BETWEEN",
      "ON",
      "IN THE",
      "IN CASE",
    ])("recognises %s as the start of the translation", async (keyword) => {
      const result = await scrape([], "departures", `AVVISO / ${keyword} SOMETHING`);

      expect(result.info).toBe("AVVISO");
    });

    it("keeps slashes that do not introduce a translation", async () => {
      const result = await scrape(
        [],
        "departures",
        "BINARI 1/2 CHIUSI / THE PLATFORMS 1/2 ARE CLOSED",
      );

      expect(result.info).toBe("BINARI 1/2 CHIUSI");
    });

    it("decodes entities and repeated apostrophes", async () => {
      const result = await scrape(
        [],
        "departures",
        "ATTENZIONE: SCIOPERO DELL''''&#39;AREA &amp; DEPOSITO",
      );

      expect(result.info).toBe("ATTENZIONE: SCIOPERO DELL'AREA & DEPOSITO");
    });

    it("is null when the banner is empty or blank", async () => {
      expect((await scrape([row()])).info).toBeNull();
      expect((await scrape([row()], "departures", "   ")).info).toBeNull();
    });

    it("is null when the notice is only a translation", async () => {
      const result = await scrape([], "departures", "/ FROM TOMORROW");

      expect(result.info).toBeNull();
    });
  });

  describe("errors", () => {
    it("wraps upstream HTTP errors in a ScraperError", async () => {
      fetchMock.on("iechub.rfi.it", textResponse("down", { status: 503 }));

      const error = await scrapeTrains("IT1728").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("Italian"),
        upstream: { host: "iechub.rfi.it", status: 503 },
      });
    });

    it("maps a 404 to a not found message", async () => {
      fetchMock.on("iechub.rfi.it", jsonResponse({}, { status: 404 }));

      const error = await scrapeTrains("IT1728", "arrivals").catch((error: unknown) => error);

      expect(error).toMatchObject({ statusCode: 404, message: expect.stringContaining("Italian") });
    });

    it("reports network failures as a 502", async () => {
      fetchMock.fail();

      const error = await scrapeTrains("IT1728").catch((error: unknown) => error);

      expect(error).toBeInstanceOf(ScraperError);
      expect(error).toMatchObject({ statusCode: 502, message: expect.stringContaining("Italian") });
    });
  });
});
