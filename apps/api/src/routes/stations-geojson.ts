import { cache } from "hono/cache";

import { COUNTRY_CODES, getCountry, type CountryCode } from "@repo/data/countries";
import { stationsGeoJSON } from "@repo/data/stations";

import { CACHE_TTL } from "../constants";
import { factory } from "../lib/env";
import { jsonError } from "../lib/http";

const stationsGeoJSONBody = JSON.stringify(stationsGeoJSON);

export const stationsGeoJsonRoutes = factory.createApp().get(
  "/",
  cache({
    cacheName: "stations-geojson-cache",
    cacheControl: CACHE_TTL.GEOJSON,
  }),
  (c) => {
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
  },
);
