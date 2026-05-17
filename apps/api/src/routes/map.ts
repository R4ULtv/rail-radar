import { cache } from "hono/cache";

import { CACHE_TTL } from "../constants";
import { factory } from "../lib/env";
import { jsonError } from "../lib/http";

const MAPBOX_STYLE = "https://api.mapbox.com/styles/v1/mapbox/dark-v11/static";
const STATION_ICON_URL = encodeURIComponent("https://static.railradar24.com/station-icon.png");
const MAX_DIMENSION = 1280;

function parseDimensions(w: string | undefined, h: string | undefined, defaults: [number, number]) {
  const width = Number.parseInt(w ?? String(defaults[0]), 10);
  const height = Number.parseInt(h ?? String(defaults[1]), 10);

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

export const mapRoutes = factory.createApp().get(
  "/static",
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
        return jsonError(c, "Invalid dimensions. Max 1280x1280.", 400);
      }

      const parts = bbox.split(",").map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        return jsonError(c, "Invalid bbox. Must be west,south,east,north.", 400);
      }

      mapboxUrl = buildMapboxUrl(`[${bbox}]`, `${width}x${height}`, token, "&padding=40");
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

      const marker = `url-${STATION_ICON_URL}(${lng},${lat})`;
      mapboxUrl = buildMapboxUrl(`${marker}/${lng},${lat},${zoom},0`, `${width}x${height}`, token);
    }

    const supportsWebp = /image\/webp/.test(c.req.header("accept") ?? "");
    const cfOptions = { image: supportsWebp ? { format: "webp" as const } : {}, quality: 100 };

    const response = await fetch(mapboxUrl, { cf: cfOptions });
    if (!response.ok) {
      return jsonError(c, "Failed to fetch map image.", 502);
    }

    const resized = response.headers.get("cf-resized") ?? "";
    if (resized.includes("err=")) {
      const fallback = await fetch(mapboxUrl);
      if (!fallback.ok) {
        return jsonError(c, "Failed to fetch map image.", 502);
      }
      return mapImageResponse(fallback);
    }

    return mapImageResponse(response);
  },
);
