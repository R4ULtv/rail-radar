import { createFileRoute } from "@tanstack/react-router";
import {
  MANIFEST_CACHE,
  MISSING_MANIFEST_CACHE,
  getStationPhotoManifest,
} from "@/lib/station-photo-manifest.server";
import { SAFE_KEY_SEGMENT } from "@/lib/station-photos";

export const Route = createFileRoute("/media/stations/$stationId/photos")({
  server: {
    handlers: {
      GET: ({ request, params }) => getStationPhotosResponse(request, params.stationId),
      HEAD: ({ request, params }) => getStationPhotosResponse(request, params.stationId),
      ANY: () => methodNotAllowed(),
    },
  },
});

function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  });
}

function internalError(request: Request, error: unknown): Response {
  console.error(
    JSON.stringify({
      message: "Station photo manifest request failed",
      path: new URL(request.url).pathname,
      method: request.method,
      requestId: request.headers.get("cf-ray"),
      status: 500,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
  return new Response("Internal server error", { status: 500 });
}

function getStationPhotosResponse(request: Request, stationId: string): Response {
  if (!SAFE_KEY_SEGMENT.test(stationId)) {
    return Response.json({ error: "Invalid station id" }, { status: 400 });
  }

  try {
    // Retain the endpoint for older clients, serving the same bundled catalog as the pages.
    const manifest = getStationPhotoManifest(stationId);
    const response = Response.json(manifest ?? { stationId, images: [] }, {
      status: manifest ? 200 : 404,
      headers: { "Cache-Control": manifest ? MANIFEST_CACHE : MISSING_MANIFEST_CACHE },
    });
    return request.method === "HEAD" ? new Response(null, response) : response;
  } catch (error) {
    return internalError(request, error);
  }
}
