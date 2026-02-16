import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { validator } from "hono/validator";

import { stationById, stations } from "@repo/data/stations";
import {
  getAnalyticsOverview,
  getRfiStatus,
  getStationStats,
  getTrendingStations,
  recordRfiRequest,
  recordStationVisit,
} from "./analytics.js";
import {
  CACHE_TTL,
  FUZZY_SEARCH_LIMIT,
  TRENDING_LIMIT,
  VALID_PERIODS,
  type Period,
} from "./constants.js";
import { fuzzySearch } from "./fuzzy.js";
import { getScraperForStation, ScraperError } from "./scrapers";

type Bindings = {
  RATE_LIMITER: RateLimit;
  STATION_ANALYTICS: AnalyticsEngineDataset;
  RFI_ANALYTICS: AnalyticsEngineDataset;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};

type Variables = {
  clientIp: string;
};

const periodValidator = validator("query", (value) => {
  const period = value["period"];
  return {
    period: VALID_PERIODS.includes(period as Period)
      ? (period as Period)
      : "day",
  };
});

const trainTypeValidator = validator("query", (value) => {
  const type = value["type"];
  return { type: type === "arrivals" ? "arrivals" : "departures" } as const;
});

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.onError((err, c) => {
  console.error("[API Error]", {
    path: c.req.path,
    method: c.req.method,
    message: err.message,
    stack: err.stack,
  });
  return c.json({ error: "Internal server error" }, 500);
});

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
      "GET /rfi/status": "Get RFI request timing statistics",
      "GET /trains/:stationId": "Alias for /stations/:id (redirects)",
    },
  });
});

app.get(
  "/stations",
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
  (c) => {
    const query = c.req.query("q");

    if (!query) {
      return c.json(stations);
    }

    const filtered = fuzzySearch(stations, query, FUZZY_SEARCH_LIMIT);
    return c.json(filtered);
  },
);

app.get(
  "/stations/trending",
  cache({
    cacheName: "analytics-cache",
    cacheControl: CACHE_TTL.ANALYTICS,
  }),
  periodValidator,
  async (c) => {
    const { period } = c.req.valid("query");

    try {
      const trending = await getTrendingStations(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        period,
        TRENDING_LIMIT,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        period,
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
    cacheControl: CACHE_TTL.ANALYTICS,
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
  "/rfi/status",
  cache({
    cacheName: "rfi-status-cache",
    cacheControl: CACHE_TTL.RFI_STATUS,
  }),
  periodValidator,
  async (c) => {
    const { period } = c.req.valid("query");

    try {
      const status = await getRfiStatus(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        period,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        period,
        ...status,
      });
    } catch {
      return c.json(
        { error: "Unable to fetch RFI status data. Please try again later." },
        500,
      );
    }
  },
);

app.get(
  "/stations/:id/stats",
  cache({
    cacheName: "analytics-cache",
    cacheControl: CACHE_TTL.ANALYTICS,
  }),
  periodValidator,
  async (c) => {
    const id = c.req.param("id");
    const station = stationById.get(id);

    if (!station) {
      return c.json(
        {
          error: "Station not found. Please try searching for another station.",
        },
        404,
      );
    }

    const { period } = c.req.valid("query");

    try {
      const { station: stationStats, topStation } = await getStationStats(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        id,
        period,
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
        period,
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
    cacheControl: CACHE_TTL.STATION_DATA,
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

    // Store IP in context to avoid re-reading header later
    c.set("clientIp", ip);
    await next();
  },
  trainTypeValidator,
  async (c) => {
    const id = c.req.param("id");
    const station = stationById.get(id);

    if (!station) {
      return c.json(
        {
          error: "Station not found. Please try searching for another station.",
        },
        404,
      );
    }

    const { type } = c.req.valid("query");

    const scraper = getScraperForStation(id);
    if (!scraper) {
      return c.json({ error: "Unsupported station region." }, 400);
    }

    const isItalian = id.startsWith("IT");

    try {
      const { trains, info, timing } = await scraper(id, type);

      // Record visit after successful response (non-blocking)
      const ip = c.get("clientIp");
      c.executionCtx.waitUntil(
        recordStationVisit(c.env.STATION_ANALYTICS, {
          stationId: station.id,
          stationName: station.name,
          ip,
          type,
        }),
      );

      // Record request timing for Italian stations (RFI)
      if (isItalian) {
        c.executionCtx.waitUntil(
          recordRfiRequest(c.env.RFI_ANALYTICS, {
            fetchMs: timing.fetchMs,
            success: true,
          }),
        );
      }

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
        // Record RFI request timing for error case (non-blocking) - only for Italian
        if (isItalian) {
          c.executionCtx.waitUntil(
            recordRfiRequest(c.env.RFI_ANALYTICS, {
              fetchMs: error.timing?.fetchMs ?? 0,
              success: false,
            }),
          );
        }

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
