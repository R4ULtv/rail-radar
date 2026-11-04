import { describe, expect, it } from "vitest";

import { parseFilterList, validateFilter } from "../../src/lib/http";

describe("parseFilterList", () => {
  it("splits, trims, lowercases and drops empty values", () => {
    expect(parseFilterList(" IT, ch ,,DE ")).toEqual(["it", "ch", "de"]);
  });

  it("returns an empty list for missing input", () => {
    expect(parseFilterList(undefined)).toEqual([]);
    expect(parseFilterList("")).toEqual([]);
  });
});

describe("validateFilter", () => {
  const valid = ["metro", "light"] as const;

  it("accepts known values", () => {
    expect(validateFilter("type", ["metro"], valid)).toEqual({ values: ["metro"], error: null });
    expect(validateFilter("type", [], valid)).toEqual({ values: [], error: null });
  });

  it("rejects the whole list when any value is unknown", () => {
    expect(validateFilter("type", ["metro", "bus"], valid)).toEqual({
      values: [],
      error: "Invalid type. Must be one of: metro, light",
    });
  });
});
