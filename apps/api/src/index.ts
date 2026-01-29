import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";

import { stationsCoords } from "@repo/data/stations";
import {
  getAnalyticsOverview,
  getStationStats,
  getTrendingStations,
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
      "GET /stations/trending":
        "Get trending stations (optional: ?period=hour|day|week, default: day)",
      "GET /stations/:id/stats":
        "Get station visit stats (optional: ?period=hour|day|week, default: day)",
      "GET /stations/:id":
        "Get station info with trains (optional: ?type=arrivals|departures)",
      "GET /analytics/overview": "Get global analytics overview",
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

app.get(
  "/stations/trending",
  cache({
    cacheName: "analytics-cache",
    cacheControl: "public, max-age=300, stale-while-revalidate=60",
  }),
  async (c) => {
    const period = c.req.query("period");
    const validPeriods = ["hour", "day", "week"] as const;
    const validPeriod: "hour" | "day" | "week" = validPeriods.includes(
      period as "hour" | "day" | "week",
    )
      ? (period as "hour" | "day" | "week")
      : "day";

    try {
      const trending = await getTrendingStations(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        validPeriod,
        5,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        period: validPeriod,
        stations: trending,
      });
    } catch {
      return c.json(
        { error: "Unable to fetch analytics data. Please try again later." },
        500,
      );
    }
  },
);

app.get(
  "/analytics/overview",
  cache({
    cacheName: "analytics-cache",
    cacheControl: "public, max-age=300, stale-while-revalidate=60",
  }),
  async (c) => {
    try {
      const overview = await getAnalyticsOverview(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        ...overview,
      });
    } catch {
      return c.json(
        { error: "Unable to fetch analytics data. Please try again later." },
        500,
      );
    }
  },
);

app.get(
  "/stations/:id/stats",
  cache({
    cacheName: "analytics-cache",
    cacheControl: "public, max-age=300, stale-while-revalidate=60",
  }),
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

    const period = c.req.query("period");
    const validPeriods = ["hour", "day", "week"] as const;
    const validPeriod: "hour" | "day" | "week" = validPeriods.includes(
      period as "hour" | "day" | "week",
    )
      ? (period as "hour" | "day" | "week")
      : "day";

    try {
      const { station: stationStats, topStation } = await getStationStats(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        id,
        validPeriod,
      );

      const isTopStation =
        stationStats && topStation
          ? stationStats.stationId === topStation.stationId
          : false;

      const percentage =
        stationStats && topStation && topStation.visits > 0
          ? Math.round((stationStats.visits / topStation.visits) * 10000) / 100
          : null;

      return c.json({
        timestamp: new Date().toISOString(),
        period: validPeriod,
        station: stationStats,
        topStation,
        comparison: {
          percentage,
          isTopStation,
        },
      });
    } catch {
      return c.json(
        { error: "Unable to fetch analytics data. Please try again later." },
        500,
      );
    }
  },
);

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
          type,
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
