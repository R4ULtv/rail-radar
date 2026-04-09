import { cache } from "hono/cache";

import { COUNTRY_CODES, getCountry, type CountryCode } from "@repo/data/countries";
import { stationById, stations, stationsGeoJSON } from "@repo/data/stations";

import {
  getTrendingStations,
  getProviderByStationId,
  getStationStats,
  recordProviderMetric,
  recordStationVisit,
} from "../analytics";
import { CACHE_TTL, FUZZY_SEARCH_LIMIT, TRENDING_LIMIT, type Period } from "../constants";
import { fuzzySearch, geoSearch, parseQuery } from "../fuzzy";
import { factory } from "../lib/env";
import { jsonError } from "../lib/http";
import { countryParamValidator, periodValidator, trainTypeValidator } from "../lib/validators";
import { rateLimit } from "../middleware/rate-limit";
import { getScraperForStation, ScraperError } from "../scrapers";

const STATION_ID_PATTERN = /^(?:[A-Z]{2,}\d+|\d{3,})$/i;
const stationsGeoJSONBody = JSON.stringify(stationsGeoJSON);

function stationNotFound(c: Parameters<typeof jsonError>[0]) {
  return jsonError(c, "Station not found. Please try searching for another station.", 404);
}

function mapTrendingStation(stationId: string) {
  const station = stationById.get(stationId);

  return {
    geo: station?.geo ?? null,
    type: station?.type ?? "rail",
    importance: station?.importance ?? 4,
  };
}

async function createTrendingResponse(
  accountId: string,
  apiToken: string,
  period: Period,
  country?: CountryCode,
) {
  const trending = await getTrendingStations(accountId, apiToken, period, TRENDING_LIMIT, country);

  return {
    timestamp: new Date().toISOString(),
    period,
    ...(country ? { country } : {}),
    stations: trending.map((station) => ({
      ...station,
      ...mapTrendingStation(station.stationId),
    })),
  };
}

export const stationsRoutes = factory
  .createApp()
  .get("/", rateLimit, (c) => {
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
      return jsonError(c, 'Invalid type. Must be "rail", "metro", or "light".', 400);
    }
    if (countryFilter && !COUNTRY_CODES.includes(countryFilter)) {
      return jsonError(c, `Invalid country. Must be one of: ${COUNTRY_CODES.join(", ")}`, 400);
    }

    c.header("Content-Type", "application/geo+json");
    c.header("Cache-Control", CACHE_TTL.GEOJSON);

    if (!typeFilter && !countryFilter) {
      return c.body(stationsGeoJSONBody);
    }

    const features = stationsGeoJSON.features.filter((feature) => {
      if (typeFilter && feature.properties.type !== typeFilter) return false;
      if (countryFilter && getCountry(feature.properties.id) !== countryFilter) return false;
      return true;
    });

    return c.body(JSON.stringify({ type: "FeatureCollection", features }));
  })
  .get(
    "/trending",
    cache({
      cacheName: "analytics-cache",
      cacheControl: CACHE_TTL.ANALYTICS,
    }),
    periodValidator,
    async (c) => {
      const { period } = c.req.valid("query");

      try {
        return c.json(
          await createTrendingResponse(
            c.env.CLOUDFLARE_ACCOUNT_ID,
            c.env.CLOUDFLARE_API_TOKEN,
            period,
          ),
        );
      } catch {
        return jsonError(c, "Unable to fetch analytics data. Please try again later.", 500);
      }
    },
  )
  .get(
    "/trending/:country",
    cache({
      cacheName: "analytics-cache",
      cacheControl: CACHE_TTL.ANALYTICS,
    }),
    countryParamValidator,
    periodValidator,
    async (c) => {
      const { country } = c.req.valid("param");
      const { period } = c.req.valid("query");

      try {
        return c.json(
          await createTrendingResponse(
            c.env.CLOUDFLARE_ACCOUNT_ID,
            c.env.CLOUDFLARE_API_TOKEN,
            period,
            country,
          ),
        );
      } catch {
        return jsonError(c, "Unable to fetch analytics data. Please try again later.", 500);
      }
    },
  )
  .get(
    "/:id/stats",
    cache({
      cacheName: "analytics-cache",
      cacheControl: CACHE_TTL.ANALYTICS,
    }),
    periodValidator,
    async (c) => {
      const id = c.req.param("id");
      const station = stationById.get(id);

      if (!station) {
        return stationNotFound(c);
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
        return jsonError(c, "Unable to fetch analytics data. Please try again later.", 500);
      }
    },
  )
  .get(
    "/:id",
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
        return stationNotFound(c);
      }

      if (station.type !== "rail") {
        return jsonError(c, "Only rail stations are supported.", 400);
      }

      const { type } = c.req.valid("query");
      const provider = getProviderByStationId(id);
      const country = getCountry(station.id) ?? "";
      const scraper = getScraperForStation(id);

      if (!scraper) {
        return jsonError(c, "Unsupported station region.", 400);
      }

      try {
        const { trains, info, timing } = await scraper(id, type, c.env);
        const ip = c.get("clientIp");

        c.executionCtx.waitUntil(
          recordStationVisit(c.env.STATION_ANALYTICS, {
            stationId: station.id,
            stationName: station.name,
            ip,
            type,
            country,
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
              country,
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
                country,
                fetchMs: error.timing?.fetchMs ?? null,
                statusCode: error.statusCode,
              }),
            );
          }

          return jsonError(c, error.message, error.statusCode);
        }

        if (provider) {
          c.executionCtx.waitUntil(
            recordProviderMetric(c.env.PROVIDER_ANALYTICS, {
              provider,
              source: "live",
              result: "error",
              requestType: type,
              stationId: station.id,
              country,
              statusCode: 500,
            }),
          );
        }

        return jsonError(c, "Unable to load train data. Please try again in a moment.", 500);
      }
    },
  );
