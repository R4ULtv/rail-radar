import { describe, expect, it } from "vitest";

import { operators } from "@repo/data/operators";

import { CACHE_TTL } from "../../src/constants";
import { request } from "../helpers/app";

type OperatorList = { count: number; operators: typeof operators };

async function list(query = "") {
  const { response } = await request(`/operators${query}`);
  return { response, body: (await response.json()) as OperatorList & { error?: string } };
}

describe("GET /operators", () => {
  it("lists every operator with a count and long cache lifetime", async () => {
    const { response, body } = await list();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.OPERATORS);
    expect(body.count).toBe(operators.length);
    expect(body.operators).toEqual(operators);
  });

  it("filters by any served country, case-insensitively, with OR for lists", async () => {
    const { body } = await list("?country=IT,ch");

    expect(body.count).toBeGreaterThan(0);
    for (const operator of body.operators) {
      expect(operator.countries.some((c) => c === "it" || c === "ch")).toBe(true);
    }
    expect(body.count).toBe(
      operators.filter((o) => o.countries.includes("it") || o.countries.includes("ch")).length,
    );
  });

  it("filters by origin country (the first listed country)", async () => {
    const { body } = await list("?origin=international");

    expect(body.count).toBe(operators.filter((o) => o.countries[0] === "international").length);
    for (const operator of body.operators) expect(operator.countries[0]).toBe("international");
  });

  it("filters by operator type and service type", async () => {
    const { body } = await list("?type=metro&serviceType=commuter");

    expect(body.count).toBe(
      operators.filter(
        (o) => o.operatorTypes.includes("metro") && o.serviceTypes.includes("commuter"),
      ).length,
    );
  });

  it("searches slug, name and description case-insensitively", async () => {
    const target = operators[0]!;
    const { body } = await list(`?q=${encodeURIComponent(target.name.toUpperCase())}`);

    expect(body.operators.map((o) => o.slug)).toContain(target.slug);
  });

  it("returns an empty list when nothing matches", async () => {
    const { response, body } = await list("?q=zzzz-no-such-operator");

    expect(response.status).toBe(200);
    expect(body).toEqual({ count: 0, operators: [] });
  });

  it.each([
    ["country", "?country=xx", "Invalid country."],
    ["origin", "?origin=mars", "Invalid origin."],
    ["type", "?type=bus", "Invalid type."],
    ["serviceType", "?serviceType=hyperloop", "Invalid serviceType."],
  ])("rejects an invalid %s filter", async (_name, query, message) => {
    const { response, body } = await list(query);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(new RegExp(`^${message.replace(".", "\\.")} Must be one of: `));
  });
});

describe("GET /operators/:slug", () => {
  it("returns one operator", async () => {
    const target = operators[0]!;
    const { response } = await request(`/operators/${target.slug}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(target);
  });

  it("returns 404 for an unknown slug", async () => {
    const { response } = await request("/operators/does-not-exist");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Operator not found." });
  });
});
