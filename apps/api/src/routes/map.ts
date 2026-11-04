import { cache } from "hono/cache";
import type { Context } from "hono";

import { CACHE_TTL } from "../constants";
import { STATION_ICON_BYTES } from "../assets/station-icon";
import { factory, type Env } from "../lib/env";
import { logRequestError } from "../lib/error-logging";
import { jsonError } from "../lib/http";
import { rateLimit } from "../middleware/rate-limit";

const MAPBOX_STYLE = "https://api.mapbox.com/styles/v1/mapbox/dark-v11/static";
const LOCAL_STATION_ICON_URL = "https://preview.railradar24.com/assets/maps/station-icon.png";
const STATION_ICON_CACHE = "public, max-age=31536000, immutable";
const MAX_DIMENSION = 1280;

function parseDimensions(w: string | undefined, h: string | undefined, defaults: [number, number]) {
  const width = Number.parseInt(w ?? String(defaults[0]), 10);
  const height = Number.parseInt(h ?? String(defaults[1]), 10);

  return { width, height };
}

function validDimensions(width: number, height: number) {
  return width >= 1 && width <= MAX_DIMENSION && height >= 1 && height <= MAX_DIMENSION;
}

function parseBbox(value: string): [number, number, number, number] | null {
  const parts = value.split(",").map((part) => Number.parseFloat(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [west, south, east, north] = parts as [number, number, number, number];
  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return null;
  }
  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return null;
  }
  if (west >= east || south >= north) {
    return null;
  }

  return [west, south, east, north];
}

function buildMapboxUrl(path: string, size: string, token: string, extra = "") {
  return `${MAPBOX_STYLE}/${path}/${size}@2x.webp?attribution=false&logo=false${extra}&access_token=${token}`;
}

/** Key the rendered image, ignoring parameter order, unused parameters and numeric spelling. */
function staticMapCacheKey(c: Context<Env>): string {
  const url = new URL(c.req.url);
  const bbox = c.req.query("bbox");
  const { width, height } = parseDimensions(
    c.req.query("w"),
    c.req.query("h"),
    bbox ? [960, 412] : [1280, 256],
  );
  const params = new URLSearchParams();
  if (bbox) {
    params.set("bbox", parseBbox(bbox)?.join(",") ?? bbox);
  } else {
    params.set("lat", String(Number.parseFloat(c.req.query("lat") ?? "")));
    params.set("lng", String(Number.parseFloat(c.req.query("lng") ?? "")));
    params.set("zoom", String(Number.parseInt(c.req.query("zoom") ?? "15", 10)));
  }
  params.set("w", String(width));
  params.set("h", String(height));
  url.search = params.toString();
  return url.toString();
}

function mapImageResponse(res: Response) {
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "image/webp" },
  });
}

function stationIconUrl(request: Request): string {
  const url = new URL(request.url);
  // Wrangler dev rewrites requests to the configured custom domain but keeps the HTTP scheme.
  const isLocal =
    url.protocol !== "https:" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";

  return isLocal ? LOCAL_STATION_ICON_URL : new URL("/map/station-icon.png", url.origin).toString();
}

export const mapRoutes = factory
  .createApp()
  .get("/station-icon.png", () => {
    return new Response(STATION_ICON_BYTES, {
      headers: {
        "Cache-Control": STATION_ICON_CACHE,
        "Content-Length": String(STATION_ICON_BYTES.byteLength),
        "Content-Type": "image/png",
      },
    });
  })
  .get(
    "/static",
    rateLimit,
    cache({
      cacheName: "static-map-webp-cache",
      cacheControl: CACHE_TTL.STATIC_MAP,
      keyGenerator: staticMapCacheKey,
    }),
    async (c) => {
      const bbox = c.req.query("bbox");
      const token = c.env.MAPBOX_TOKEN;

      let mapboxUrl: string;

      if (bbox) {
        const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"), [960, 412]);

        if (!validDimensions(width, height)) {
          return jsonError(c, "Invalid dimensions. Max 1280x1280.", 400);
        }

        const parsedBbox = parseBbox(bbox);
        if (!parsedBbox) {
          return jsonError(c, "Invalid bbox. Must be west,south,east,north.", 400);
        }

        mapboxUrl = buildMapboxUrl(
          `[${parsedBbox.join(",")}]`,
          `${width}x${height}`,
          token,
          "&padding=40",
        );
      } else {
        const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"), [1280, 256]);

        if (!validDimensions(width, height)) {
          return jsonError(c, "Invalid dimensions. Max 1280x1280.", 400);
        }

        const lat = Number.parseFloat(c.req.query("lat") ?? "");
        const lng = Number.parseFloat(c.req.query("lng") ?? "");
        const zoom = Number.parseInt(c.req.query("zoom") ?? "15", 10);

        if (
          Number.isNaN(lat) ||
          Number.isNaN(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return jsonError(c, "Invalid coordinates.", 400);
        }
        if (Number.isNaN(zoom) || zoom < 0 || zoom > 22) {
          return jsonError(c, "Invalid zoom level.", 400);
        }

        const marker = `url-${encodeURIComponent(stationIconUrl(c.req.raw))}(${lng},${lat})`;
        mapboxUrl = buildMapboxUrl(
          `${marker}/${lng},${lat},${zoom},0`,
          `${width}x${height}`,
          token,
        );
      }

      if (c.req.method === "HEAD") {
        return new Response(null, {
          headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_TTL.STATIC_MAP },
        });
      }

      // Cache hits skip this handler. Each upstream request uses one allowance per IP.
      const { success } = await c.env.MAP_GENERATION_RATE_LIMITER.limit({
        key: `static-map:${c.get("clientIp")}`,
      });
      if (!success) {
        return c.json(
          { error: "Too many map images requested. Please wait a minute and try again." },
          429,
          {
            "Retry-After": "60",
            "Cache-Control": "no-store",
          },
        );
      }

      const response = await fetch(mapboxUrl);
      if (!response.ok) {
        logRequestError(
          c,
          new Error("Mapbox static image request failed"),
          "Map image request failed",
          {
            status: 502,
            provider: "mapbox",
            upstreamStatus: response.status,
          },
        );
        return jsonError(c, "Failed to fetch map image.", 502);
      }

      return mapImageResponse(response);
    },
  );
