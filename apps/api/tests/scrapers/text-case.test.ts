import { describe, expect, it } from "vitest";

import { formatNotice, formatPlaceNames } from "../../src/scrapers/text-case";

describe("formatPlaceNames", () => {
  it.each([
    ["TORINO PORTA NUOVA", "Torino Porta Nuova"],
    ["REGGIO DI CALABRIA CENTRALE", "Reggio di Calabria Centrale"],
    ["DI VITTORIO", "Di Vittorio"],
    ["BASEL SBB", "Basel SBB"],
    ["FIRENZE S.M.N.", "Firenze S.M.N."],
    ["FRANKFURT (M) HBF", "Frankfurt (M) Hbf"],
    ["VENEZIA S.LUCIA", "Venezia S.Lucia"],
    ["MILANO C.LE", "Milano C.le"],
    ["MI.P.GARIBALDI", "Mi.P.Garibaldi"],
    ["PONTE D'ADDA", "Ponte d'Adda"],
    ["SANT'ANTIMO", "Sant'Antimo"],
    ["BRESCIA-IDRO", "Brescia-Idro"],
    ["CERNOBBIO/COMO", "Cernobbio/Como"],
  ])("cases %s as %s", (text, expected) => {
    expect(formatPlaceNames(text)).toBe(expected);
  });

  it("cases each stop in a list of them", () => {
    expect(formatPlaceNames("RHO FIERA MILANO (10:14) - TORINO P. SUSA (10:53)")).toBe(
      "Rho Fiera Milano (10:14) - Torino P. Susa (10:53)",
    );
    expect(formatPlaceNames("BOLOGNA CENTRALE, FIRENZE SMN")).toBe("Bologna Centrale, Firenze SMN");
  });

  it("leaves names that already have lowercase letters alone", () => {
    expect(formatPlaceNames("Zürich HB")).toBe("Zürich HB");
    expect(formatPlaceNames("12")).toBe("12");
  });

  it("tidies spaces", () => {
    expect(formatPlaceNames("  NAPOLI   CENTRALE ")).toBe("Napoli Centrale");
  });
});

describe("formatNotice", () => {
  it("cases an all-caps notice as sentences", () => {
    expect(
      formatNotice(
        "DALLE ORE 9.01 ALLE ORE 16.59 DI LUNEDI 9 NOVEMBRE, I TRENI ITALO POTRANNO SUBIRE RITARDI O VARIAZIONI , PER UNO SCIOPERO DEL PERSONALE. INFO SUI CANALI WEB E IN STAZIONE",
      ),
    ).toBe(
      "Dalle ore 9.01 alle ore 16.59 di lunedi 9 novembre, i treni Italo potranno subire ritardi o variazioni, per uno sciopero del personale. Info sui canali web e in stazione",
    );
  });

  it("keeps acronyms in capitals", () => {
    expect(formatNotice("SCIOPERO DEL PERSONALE FS E RFI")).toBe("Sciopero del personale FS e RFI");
  });

  it("leaves notices that already have lowercase letters alone", () => {
    expect(formatNotice("Treno Cancellato")).toBe("Treno Cancellato");
  });
});
