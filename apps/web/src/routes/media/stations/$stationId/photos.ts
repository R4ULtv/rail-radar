import { createFileRoute } from "@tanstack/react-router";
import { SAFE_KEY_SEGMENT, getStationPhotoManifest } from "@/lib/station-photo-manifest.server";

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
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return new Response("Internal server error", { status: 500 });
}

async function getStationPhotosResponse(request: Request, stationId: string): Promise<Response> {
  if (!SAFE_KEY_SEGMENT.test(stationId)) {
    return Response.json({ error: "Invalid station id" }, { status: 400 });
  }

  try {
    const { response } = await getStationPhotoManifest(request, stationId);
    // Cache API responses have immutable headers. Clone the response so the app-wide security
    // middleware can attach its headers before sending it to the browser.
    return new Response(response.body, response);
  } catch (error) {
    return internalError(request, error);
  }
}
