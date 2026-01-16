import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";

import { stationsCoords } from "@repo/data/stations";
import {
  getStationVisits,
  getTopStations,
  recordStationVisit,
} from "./analytics.js";
import { fuzzySearch } from "./fuzzy.js";
import { scrapeTrains, ScraperError } from "./scraper.js";

const stations = stationsCoords.filter((s) => s.geo);

type Bindings = {
  RATE_LIMITER: RateLimit;
  STATION_ANALYTICS: AnalyticsEngineDataset;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://www.railradar24.com",
    ],
  }),
);

app.get("/", (c) => {
  return c.json({
    name: "Rail Radar API",
    version: "1.0.0",
    endpoints: {
      "GET /": "API structure and documentation",
      "GET /stations": "List all stations (optional: ?q=search query)",
      "GET /stations/top": "Get top 5 most visited stations",
      "GET /stations/:id":
        "Get station info with trains (optional: ?type=arrivals|departures)",
      "GET /stations/:id/visits": "Get visit count for a specific station",
      "GET /trains/:stationId": "Alias for /stations/:id (redirects)",
    },
  });
});

app.get("/stations", (c) => {
  const query = c.req.query("q");

  if (!query) {
    return c.json(stations);
  }

  const filtered = fuzzySearch(stations, query, 20);
  return c.json(filtered);
});

app.get("/stations/top", async (c) => {
  try {
    const topStations = await getTopStations(
      c.env.CLOUDFLARE_ACCOUNT_ID,
      c.env.CLOUDFLARE_API_TOKEN,
      5,
    );

    return c.json({
      timestamp: new Date().toISOString(),
      stations: topStations,
    });
  } catch {
    return c.json(
      { error: "Unable to fetch analytics data. Please try again later." },
      500,
    );
  }
});

app.get("/stations/:id/visits", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json(
      {
        error:
          "Invalid station. Please try searching for a different station.",
      },
      400,
    );
  }

  const station = stations.find((s) => s.id === id);

  if (!station) {
    return c.json(
      {
        error: "Station not found. Please try searching for another station.",
      },
      404,
    );
  }

  try {
    const { visits, uniqueVisitors } = await getStationVisits(
      c.env.CLOUDFLARE_ACCOUNT_ID,
      c.env.CLOUDFLARE_API_TOKEN,
      id,
    );

    return c.json({
      id: station.id,
      name: station.name,
      visits,
      uniqueVisitors,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json(
      { error: "Unable to fetch analytics data. Please try again later." },
      500,
    );
  }
});

app.get(
  "/stations/:id",
  cache({
    cacheName: "stations-cache",
    cacheControl: "public, max-age=25, stale-while-revalidate=5",
  }),
  async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env.RATE_LIMITER.limit({ key: ip });

    if (!success) {
      return c.json(
        { error: "Too many requests. Please wait a moment and try again." },
        429,
      );
    }

    await next();
  },
  async (c) => {
    const id = parseInt(c.req.param("id"), 10);

    if (isNaN(id)) {
      return c.json(
        {
          error:
            "Invalid station. Please try searching for a different station.",
        },
        400,
      );
    }

    const station = stations.find((s) => s.id === id);

    if (!station) {
      return c.json(
        {
          error: "Station not found. Please try searching for another station.",
        },
        404,
      );
    }

    const type = c.req.query("type") === "arrivals" ? "arrivals" : "departures";

    try {
      const { trains, info } = await scrapeTrains(id, type);

      // Record visit after successful response (non-blocking)
      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      c.executionCtx.waitUntil(
        recordStationVisit(c.env.STATION_ANALYTICS, {
          stationId: station.id,
          stationName: station.name,
          ip,
        }),
      );

      return c.json({
        id: station.id,
        name: station.name,
        geo: station.geo,
        timestamp: new Date().toISOString(),
        info,
        trains,
      });
    } catch (error) {
      if (error instanceof ScraperError) {
        return c.json({ error: error.message }, error.statusCode);
      }
      return c.json(
        { error: "Unable to load train data. Please try again in a moment." },
        500,
      );
    }
  },
);

export default app;
