import { describe, expect, it } from "vitest";

import type { Station } from "@repo/data";

import { createStationSearch } from "../../src/search";

function station(id: string, name: string, importance: Station["importance"] = 3): Station {
  return { id, name, type: "rail", importance };
}

const STATIONS = [
  station("IT2416", "Roma Termini", 1),
  station("IT2417", "Roma Tiburtina", 1),
  station("IT2418", "Roma Ostiense", 2),
  station("IT9000", "Ciampino Roma", 3),
  station("IT9001", "Bivio Romanina", 4),
  station("IT1728", "Milano Centrale", 1),
  station("IT1729", "Milano Porta Garibaldi", 2),
  station("BE11007", "Schaarbeek/Schaerbeek", 4),
  station("CH03000", "Zürich HB", 1),
  station("FI1", "Tikkurila", 2),
];

const search = createStationSearch(STATIONS);
const ids = (query: string, limit?: number) => search(query, limit).map((s) => s.id);

describe("createStationSearch", () => {
  it("returns nothing for empty, whitespace or one-character queries", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
    expect(search("r")).toEqual([]);
  });

  it("returns nothing for a non-positive limit", () => {
    expect(search("roma", 0)).toEqual([]);
  });

  it("puts an exact station ID first, ignoring case and spaces", () => {
    expect(ids("it 1728")[0]).toBe("IT1728");
    expect(ids("ch03000")).toEqual(["CH03000"]);
  });

  it("does not treat names as station IDs", () => {
    expect(ids("IT")).toEqual([]);
  });

  it("ranks prefix matches before word and substring matches", () => {
    // Prefix (by importance) -> word prefix -> substring.
    expect(ids("roma")).toEqual(["IT2416", "IT2417", "IT2418", "IT9000", "IT9001"]);
  });

  it("ranks an exact name match first", () => {
    expect(ids("roma termini")[0]).toBe("IT2416");
  });

  it("matches word prefixes in order and out of order", () => {
    expect(ids("mil cen")).toEqual(["IT1728"]);
    expect(ids("centrale milano")).toEqual(["IT1728"]);
  });

  it("ignores diacritics and case", () => {
    expect(ids("zurich")).toEqual(["CH03000"]);
    expect(ids("ZÜRICH hb")).toEqual(["CH03000"]);
  });

  it("matches either side of a bilingual slash name", () => {
    expect(ids("schaerbeek")).toEqual(["BE11007"]);
    expect(ids("schaarbeek")).toEqual(["BE11007"]);
  });

  it("matches substrings inside a word", () => {
    expect(ids("kkuri")).toEqual(["FI1"]);
  });

  it("respects the limit while keeping the best results", () => {
    expect(ids("roma", 2)).toEqual(["IT2416", "IT2417"]);
  });

  it("breaks ties by importance, then name length, then name", () => {
    const tied = createStationSearch([
      station("XX3", "Alpha Long Name", 2),
      station("XX2", "Alpha", 2),
      station("XX1", "Alpha B", 1),
    ]);
    expect(tied("alp").map((s) => s.id)).toEqual(["XX1", "XX2", "XX3"]);
  });
});
