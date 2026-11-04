import { describe, expect, it } from "vitest";

import { request } from "../helpers/app";

describe("GET /", () => {
  it("describes the API as plain text", async () => {
    const { response } = await request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/^text\/plain/);
    const body = await response.text();
    expect(body).toContain("Rail Radar API");
    expect(body).toContain("GET /stations/:id\n  Get station info with trains");
    expect(body).toContain("contact@railradar24.com");
  });
});

describe("GET /robots.txt", () => {
  it("disallows all crawlers", async () => {
    const { response } = await request("/robots.txt");

    expect(await response.text()).toBe("User-agent: *\nDisallow: /");
  });
});

describe("unknown routes", () => {
  it("return a JSON 404", async () => {
    const { response } = await request("/nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

describe("global middleware", () => {
  it("sets secure headers while allowing cross-origin embedding of resources", async () => {
    const { response } = await request("/");

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
  });

  it.each([
    "https://www.railradar24.com",
    "https://preview.railradar24.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ])("allows CORS from %s", async (origin) => {
    const { response } = await request("/", { headers: { Origin: origin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("Retry-After,X-Request-Id");
  });

  it("does not allow CORS from other origins", async () => {
    const { response } = await request("/", { headers: { Origin: "https://evil.example" } });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers CORS preflight requests", async () => {
    const { response } = await request("/stations/search", {
      method: "OPTIONS",
      headers: {
        Origin: "https://www.railradar24.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.railradar24.com");
  });
});
