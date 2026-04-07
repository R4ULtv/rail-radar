import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";

import { COUNTRY_CODES, getCountry, type CountryCode } from "@repo/data/countries";
import {
  operatorBySlug,
  operators,
  type Operator,
  type OperatorCountry,
  type OperatorType,
  type ServiceType,
} from "@repo/data/operators";
import { stationById, stations, stationsGeoJSON } from "@repo/data/stations";
import {
  getAnalyticsOverview,
  getProviderByStationId,
  getStationStats,
  getTrendingStations,
  recordProviderMetric,
  recordStationVisit,
} from "./analytics";
import {
  CACHE_TTL,
  FUZZY_SEARCH_LIMIT,
  TRENDING_LIMIT,
  VALID_PERIODS,
  type Period,
} from "./constants";
import { fuzzySearch, geoSearch, parseQuery } from "./fuzzy";
import { getScraperForStation, ScraperError } from "./scrapers";

type Bindings = {
  RATE_LIMITER: RateLimit;
  STATION_ANALYTICS: AnalyticsEngineDataset;
  PROVIDER_ANALYTICS: AnalyticsEngineDataset;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  NS_API_KEY: string;
  LDBWS_API_KEY: string;
  TRAFIKLAB_KEY: string;
  MAPBOX_TOKEN: string;
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

const STATION_ID_PATTERN = /^(?:[A-Z]{2,}\d+|\d{3,})$/i;
const OPERATOR_COUNTRIES = [
  "international",
  ...COUNTRY_CODES,
] as const satisfies readonly OperatorCountry[];
const OPERATOR_TYPES = [
  "passenger",
  "cargo",
  "metro",
  "light-rail",
] as const satisfies readonly OperatorType[];
const SERVICE_TYPES = [
  "high-speed",
  "intercity",
  "regional",
  "commuter",
  "night-train",
  "international",
  "scenic",
] as const satisfies readonly ServiceType[];
const MAX_OPERATOR_LIMIT = 100;

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
      "GET /operators":
        "List train operators (optional: ?q=search&country=it|international&origin=international&type=passenger&serviceType=high-speed&limit=20)",
      "GET /operators/:slug": "Get a train operator by slug",
      "GET /stations": "List all stations (optional: ?q=search query)",
      "GET /stations/trending":
        "Get trending stations (optional: ?period=hour|day|week, default: day)",
      "GET /stations/trending/:country":
        "Get trending stations by country (it|ch|fi|be|nl|no|se|uk|ie, optional: ?period=hour|day|week)",
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

// --- Operator routes ---

function parseFilterList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function validateFilter<T extends string>(
  name: string,
  values: string[],
  validValues: readonly T[],
): { values: T[]; error: string | null } {
  const invalid = values.filter((value) => !validValues.includes(value as T));
  if (invalid.length > 0) {
    return {
      values: [],
      error: `Invalid ${name}. Must be one of: ${validValues.join(", ")}`,
    };
  }
  return { values: values as T[], error: null };
}

function matchesOperatorQuery(operator: Operator, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  return [
    operator.slug,
    operator.name,
    operator.description,
    operator.website,
    operator.headquarters,
    operator.parentCompany,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

app.get(
  "/operators",
  cache({
    cacheName: "operators-cache",
    cacheControl: CACHE_TTL.OPERATORS,
  }),
  (c) => {
    const countriesResult = validateFilter(
      "country",
      parseFilterList(c.req.query("country")),
      OPERATOR_COUNTRIES,
    );
    if (countriesResult.error) return c.json({ error: countriesResult.error }, 400);

    const originResult = validateFilter(
      "origin",
      parseFilterList(c.req.query("origin")),
      OPERATOR_COUNTRIES,
    );
    if (originResult.error) return c.json({ error: originResult.error }, 400);

    const operatorTypesResult = validateFilter(
      "type",
      parseFilterList(c.req.query("type")),
      OPERATOR_TYPES,
    );
    if (operatorTypesResult.error) return c.json({ error: operatorTypesResult.error }, 400);

    const serviceTypesResult = validateFilter(
      "serviceType",
      parseFilterList(c.req.query("serviceType")),
      SERVICE_TYPES,
    );
    if (serviceTypesResult.error) return c.json({ error: serviceTypesResult.error }, 400);

    const limitQuery = c.req.query("limit");
    const limit = limitQuery ? Number.parseInt(limitQuery, 10) : null;
    if (limitQuery && (!limit || limit < 1 || limit > MAX_OPERATOR_LIMIT)) {
      return c.json({ error: `Invalid limit. Must be between 1 and ${MAX_OPERATOR_LIMIT}.` }, 400);
    }

    const query = c.req.query("q")?.trim();
    const filtered = operators.filter((operator) => {
      if (query && !matchesOperatorQuery(operator, query)) return false;
      if (
        countriesResult.values.length > 0 &&
        !countriesResult.values.some((country) => operator.countries.includes(country))
      ) {
        return false;
      }
      if (
        originResult.values.length > 0 &&
        !originResult.values.includes(operator.countries[0] as OperatorCountry)
      ) {
        return false;
      }
      if (
        operatorTypesResult.values.length > 0 &&
        !operatorTypesResult.values.some((type) => operator.operatorTypes.includes(type))
      ) {
        return false;
      }
      if (
        serviceTypesResult.values.length > 0 &&
        !serviceTypesResult.values.some((type) => operator.serviceTypes.includes(type))
      ) {
        return false;
      }
      return true;
    });

    return c.json({
      count: filtered.length,
      operators: limit ? filtered.slice(0, limit) : filtered,
    });
  },
);

app.get(
  "/operators/:slug",
  cache({
    cacheName: "operators-cache",
    cacheControl: CACHE_TTL.OPERATORS,
  }),
  (c) => {
    const operator = operatorBySlug.get(c.req.param("slug"));
    if (!operator) {
      return c.json({ error: "Operator not found." }, 404);
    }
    return c.json(operator);
  },
);

// --- Map routes ---

const MAPBOX_STYLE = "https://api.mapbox.com/styles/v1/mapbox/dark-v11/static";
const STATION_ICON_URL = encodeURIComponent("https://www.railradar24.com/station-icon.png");
const MAX_DIMENSION = 1280;

function parseDimensions(w: string | undefined, h: string | undefined, defaults: [number, number]) {
  const width = parseInt(w ?? String(defaults[0]), 10);
  const height = parseInt(h ?? String(defaults[1]), 10);
  return { width, height };
}

function validDimensions(width: number, height: number) {
  return width >= 1 && width <= MAX_DIMENSION && height >= 1 && height <= MAX_DIMENSION;
}

function buildMapboxUrl(path: string, size: string, token: string, extra = "") {
  return `${MAPBOX_STYLE}/${path}/${size}@2x?attribution=false&logo=false${extra}&access_token=${token}`;
}

function mapImageResponse(res: Response) {
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "image/png" },
  });
}

app.get(
  "/map/static",
  cache({
    cacheName: "static-map-cache",
    cacheControl: CACHE_TTL.STATIC_MAP,
  }),
  async (c) => {
    const bbox = c.req.query("bbox");
    const token = c.env.MAPBOX_TOKEN;

    let mapboxUrl: string;

    if (bbox) {
      const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"), [960, 412]);
      if (!validDimensions(width, height)) {
        return c.json({ error: "Invalid dimensions. Max 1280x1280." }, 400);
      }

      const parts = bbox.split(",").map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return c.json({ error: "Invalid bbox. Must be west,south,east,north." }, 400);
      }

      mapboxUrl = buildMapboxUrl(`[${bbox}]`, `${width}x${height}`, token, "&padding=40");
    } else {
      const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"), [1280, 256]);
      if (!validDimensions(width, height)) {
        return c.json({ error: "Invalid dimensions. Max 1280x1280." }, 400);
      }

      const lat = parseFloat(c.req.query("lat") ?? "");
      const lng = parseFloat(c.req.query("lng") ?? "");
      const zoom = parseInt(c.req.query("zoom") ?? "15", 10);

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return c.json({ error: "Invalid coordinates." }, 400);
      }
      if (isNaN(zoom) || zoom < 0 || zoom > 22) {
        return c.json({ error: "Invalid zoom level." }, 400);
      }

      const marker = `url-${STATION_ICON_URL}(${lng},${lat})`;
      mapboxUrl = buildMapboxUrl(`${marker}/${lng},${lat},${zoom},0`, `${width}x${height}`, token);
    }

    const supportsWebp = /image\/webp/.test(c.req.header("accept") ?? "");
    const cfOptions = { image: supportsWebp ? { format: "webp" as const } : {}, quality: 100 };

    const response = await fetch(mapboxUrl, { cf: cfOptions });
    if (!response.ok) {
      return c.json({ error: "Failed to fetch map image." }, 502);
    }

    const resized = response.headers.get("cf-resized") ?? "";
    if (resized.includes("err=")) {
      const fallback = await fetch(mapboxUrl);
      if (!fallback.ok) {
        return c.json({ error: "Failed to fetch map image." }, 502);
      }
      return mapImageResponse(fallback);
    }

    return mapImageResponse(response);
  },
);

// --- Station routes ---

const stationsGeoJSONBody = JSON.stringify(stationsGeoJSON);

app.get("/stations", rateLimit, (c) => {
  const query = c.req.query("q");

  if (query) {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2 && !STATION_ID_PATTERN.test(trimmedQuery)) {
      return c.json([]);
    }

    const parsed = parseQuery(query);
    const filters = { country: parsed.country, type: parsed.type };

    if (parsed.coords) {
      return c.json(
        geoSearch(stations, parsed.coords.lat, parsed.coords.lng, FUZZY_SEARCH_LIMIT, filters),
      );
    }
    if (parsed.nameQuery) {
      return c.json(fuzzySearch(stations, parsed.nameQuery, FUZZY_SEARCH_LIMIT, filters));
    }
    return c.json(fuzzySearch(stations, "", FUZZY_SEARCH_LIMIT, filters));
  }

  const typeFilter = c.req.query("type") as "rail" | "metro" | "light" | undefined;
  const countryFilter = c.req.query("country") as CountryCode | undefined;

  if (typeFilter && !["rail", "metro", "light"].includes(typeFilter)) {
    return c.json({ error: 'Invalid type. Must be "rail", "metro", or "light".' }, 400);
  }
  if (countryFilter && !COUNTRY_CODES.includes(countryFilter)) {
    return c.json({ error: `Invalid country. Must be one of: ${COUNTRY_CODES.join(", ")}` }, 400);
  }

  c.header("Content-Type", "application/geo+json");
  c.header("Cache-Control", CACHE_TTL.GEOJSON);

  if (!typeFilter && !countryFilter) {
    return c.body(stationsGeoJSONBody);
  }

  const features = stationsGeoJSON.features.filter((f) => {
    if (typeFilter && f.properties.type !== typeFilter) return false;
    if (countryFilter && getCountry(f.properties.id) !== countryFilter) return false;
    return true;
  });

  return c.body(JSON.stringify({ type: "FeatureCollection", features }));
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
        stations: trending.map((s) => {
          const station = stationById.get(s.stationId);
          return {
            ...s,
            geo: station?.geo ?? null,
            type: station?.type ?? "rail",
            importance: station?.importance ?? 4,
          };
        }),
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
        stations: trending.map((s) => {
          const station = stationById.get(s.stationId);
          return {
            ...s,
            geo: station?.geo ?? null,
            type: station?.type ?? "rail",
            importance: station?.importance ?? 4,
          };
        }),
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
    const provider = getProviderByStationId(id);

    const scraper = getScraperForStation(id);
    if (!scraper) {
      return c.json({ error: "Unsupported station region." }, 400);
    }

    try {
      const { trains, info, timing } = await scraper(id, type, c.env);

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
      if (provider) {
        c.executionCtx.waitUntil(
          recordProviderMetric(c.env.PROVIDER_ANALYTICS, {
            provider,
            source: "live",
            result: "success",
            requestType: type,
            stationId: station.id,
            country: getCountry(station.id) ?? "",
            fetchMs: timing.fetchMs,
            statusCode: 200,
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
        if (provider) {
          c.executionCtx.waitUntil(
            recordProviderMetric(c.env.PROVIDER_ANALYTICS, {
              provider,
              source: "live",
              result: error.statusCode === 504 ? "timeout" : "error",
              requestType: type,
              stationId: station.id,
              country: getCountry(station.id) ?? "",
              fetchMs: error.timing?.fetchMs ?? null,
              statusCode: error.statusCode,
            }),
          );
        }
        return c.json({ error: error.message }, error.statusCode);
      }
      if (provider) {
        c.executionCtx.waitUntil(
          recordProviderMetric(c.env.PROVIDER_ANALYTICS, {
            provider,
            source: "live",
            result: "error",
            requestType: type,
            stationId: station.id,
            country: getCountry(station.id) ?? "",
            statusCode: 500,
          }),
        );
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
