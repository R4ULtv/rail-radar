import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";

import { stationsCoords as stations } from "@repo/data";
import { scrapeTrains } from "./scraper.js";

type Bindings = {
  RATE_LIMITER: RateLimit;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RATE_LIMITER.limit({ key: ip });

  if (!success) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  await next();
});

app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://rail-radar-web.vercel.app",
    ],
  }),
);

app.get("/", (c) => {
  return c.redirect("https://rail-radar-web.vercel.app");
});

app.get("/stations", (c) => {
  const query = c.req.query("q");

  if (!query) {
    return c.json(stations);
  }

  const q = query.toLowerCase();
  const filtered = stations
    .filter((station) =>
      station.name
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(q)),
    )
    .slice(0, 20);

  return c.json(filtered);
});

app.get("/stations/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid station ID" }, 400);
  }

  const station = stations.find((s) => s.id === id);

  if (!station) {
    return c.json({ error: "Station not found" }, 404);
  }

  return c.json(station);
});

app.get(
  "/trains/:stationId",
  cache({
    cacheName: "trains-cache",
    cacheControl: "public, max-age=25, stale-while-revalidate=5",
  }),
  async (c) => {
    const stationId = parseInt(c.req.param("stationId"), 10);

    if (isNaN(stationId)) {
      return c.json({ error: "Invalid station ID" }, 400);
    }

    const stationExists = stations.some((s) => s.id === stationId);
    if (!stationExists) {
      return c.json({ error: "Station not found" }, 404);
    }

    const type = c.req.query("type") === "arrivals" ? "arrivals" : "departures";

    try {
      const trains = await scrapeTrains(stationId, type);
      return c.json({
        timestamp: new Date().toISOString(),
        trains,
      });
    } catch (error) {
      return c.json({ error: "Failed to fetch train data" }, 500);
    }
  },
);

export default app;
