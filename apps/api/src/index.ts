import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";

import {
  COUNTRY_CODES,
  getCountry,
  stationById,
  stations,
  type CountryCode,
} from "@repo/data/stations";
import {
  getAnalyticsOverview,
  getStationStats,
  getTrendingStations,
  recordStationVisit,
} from "./analytics";
import {
  CACHE_TTL,
  FUZZY_SEARCH_LIMIT,
  TRENDING_LIMIT,
  VALID_PERIODS,
  type Period,
} from "./constants";
import { fuzzySearch } from "./fuzzy";
import { getScraperForStation, ScraperError } from "./scrapers";

type Bindings = {
  RATE_LIMITER: RateLimit;
  STATION_ANALYTICS: AnalyticsEngineDataset;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  NS_API_KEY: string;
};

type Variables = {
  clientIp: string;
};

type Env = { Bindings: Bindings; Variables: Variables };

const rateLimit = createMiddleware<Env>(async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RATE_LIMITER.limit({ key: ip });

  if (!success) {
    return c.json({ error: "Too many requests. Please wait a moment and try again." }, 429);
  }

  c.set("clientIp", ip);
  await next();
});

const periodValidator = validator("query", (value, c) => {
  const period = value["period"];
  if (period !== undefined && !VALID_PERIODS.includes(period as Period)) {
    return c.json({ error: `Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}` }, 400);
  }
  return { period: (period as Period) ?? "day" };
});

const trainTypeValidator = validator("query", (value, c) => {
  const type = value["type"];
  if (type !== undefined && type !== "arrivals" && type !== "departures") {
    return c.json({ error: 'Invalid type. Must be "arrivals" or "departures".' }, 400);
  }
  return { type: (type ?? "departures") as "arrivals" | "departures" };
});

const app = new Hono<Env>();

app.onError((err, c) => {
  console.error("[API Error]", {
    path: c.req.path,
    method: c.req.method,
    message: err.message,
    stack: err.stack,
  });
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://www.railradar24.com"],
  }),
);

// --- Info routes ---

app.get("/", (c) => {
  return c.json({
    name: "Rail Radar API",
    version: "1.0.0",
    endpoints: {
      "GET /": "API structure and documentation",
      "GET /stations": "List all stations (optional: ?q=search query)",
      "GET /stations/trending":
        "Get trending stations (optional: ?period=hour|day|week, default: day)",
      "GET /stations/trending/:country":
        "Get trending stations by country (it|ch|fi|be|nl, optional: ?period=hour|day|week)",
      "GET /stations/:id/stats":
        "Get station visit stats (optional: ?period=hour|day|week, default: day)",
      "GET /stations/:id": "Get station info with trains (optional: ?type=arrivals|departures)",
      "GET /analytics/overview": "Get global analytics overview",
    },
  });
});

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nDisallow: /");
});

// --- Station routes ---

app.get("/stations", rateLimit, (c) => {
  const query = c.req.query("q");

  if (!query) {
    return c.json(stations);
  }

  const filtered = fuzzySearch(stations, query, FUZZY_SEARCH_LIMIT);
  return c.json(filtered);
});

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
      return c.json({ error: "Unable to fetch analytics data. Please try again later." }, 500);
    }
  },
);

app.get(
  "/stations/trending/:country",
  cache({
    cacheName: "analytics-cache",
    cacheControl: CACHE_TTL.ANALYTICS,
  }),
  periodValidator,
  async (c) => {
    const country = c.req.param("country") as CountryCode;

    if (!COUNTRY_CODES.includes(country)) {
      return c.json({ error: `Invalid country. Must be one of: ${COUNTRY_CODES.join(", ")}` }, 400);
    }

    const { period } = c.req.valid("query");

    try {
      const trending = await getTrendingStations(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
        period,
        TRENDING_LIMIT,
        country,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        period,
        country,
        stations: trending,
      });
    } catch {
      return c.json({ error: "Unable to fetch analytics data. Please try again later." }, 500);
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
        stationStats && topStation ? stationStats.stationId === topStation.stationId : false;

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
      return c.json({ error: "Unable to fetch analytics data. Please try again later." }, 500);
    }
  },
);

app.get(
  "/stations/:id",
  rateLimit,
  cache({
    cacheName: "stations-cache",
    cacheControl: CACHE_TTL.STATION_DATA,
  }),
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

    if (station.type !== "rail") {
      return c.json({ error: "Only rail stations are supported." }, 400);
    }

    const { type } = c.req.valid("query");

    const scraper = getScraperForStation(id);
    if (!scraper) {
      return c.json({ error: "Unsupported station region." }, 400);
    }

    try {
      const { trains, info } = await scraper(id, type, c.env);

      // Record visit after successful response (non-blocking)
      const ip = c.get("clientIp");
      c.executionCtx.waitUntil(
        recordStationVisit(c.env.STATION_ANALYTICS, {
          stationId: station.id,
          stationName: station.name,
          ip,
          type,
          country: getCountry(station.id) ?? "",
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
      return c.json({ error: "Unable to load train data. Please try again in a moment." }, 500);
    }
  },
);

// --- Analytics routes ---

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
      return c.json({ error: "Unable to fetch analytics data. Please try again later." }, 500);
    }
  },
);

export default app;
