import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { getStationOgResponse } from "@/lib/station-og.server";

async function getImage(request: Request): Promise<Response> {
  try {
    return await getStationOgResponse(request, {
      rateLimiter: env.RATE_LIMITER,
      bucket: env.STATION_IMAGES,
      waitUntil,
    });
  } catch (error) {
    console.error(
      "Station OG image request failed",
      error instanceof Error ? error.message : String(error),
    );
    return new Response("Image unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/media/og")({
  server: {
    handlers: {
      GET: ({ request }) => getImage(request),
      HEAD: ({ request }) => getImage(request),
      ANY: () =>
        new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }),
    },
  },
});
