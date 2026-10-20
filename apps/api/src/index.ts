import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { factory } from "./lib/env";
import { logRequestError } from "./lib/error-logging";
import { jsonError } from "./lib/http";
import { analyticsRoutes } from "./routes/analytics";
import { linesGeoJsonRoutes, linesRoutes, stationLinesRoutes } from "./routes/lines";
import { mapRoutes } from "./routes/map";
import { operatorsRoutes } from "./routes/operators";
import { rootRoutes } from "./routes/root";
import { stationsGeoJsonRoutes } from "./routes/stations-geojson";
import { stationsRoutes } from "./routes/stations";

export function createApp() {
  const app = factory.createApp();

  app.onError((err, c) => {
    logRequestError(c, err, "Unhandled API error", { status: 500 });

    return jsonError(c, "Internal server error", 500);
  });

  app.notFound((c) => {
    return jsonError(c, "Not found", 404);
  });

  app.use("*", async (c, next) => {
    c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
    c.set("requestStartedAt", performance.now());
    await next();
  });
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
  app.use(
    "*",
    cors({
      exposeHeaders: ["Retry-After", "X-Request-Id"],
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://www.railradar24.com",
        "https://preview.railradar24.com",
      ],
    }),
  );

  return app
    .route("/", rootRoutes)
    .route("/operators", operatorsRoutes)
    .route("/lines", linesRoutes)
    .route("/lines.geojson", linesGeoJsonRoutes)
    .route("/map", mapRoutes)
    .route("/stations.geojson", stationsGeoJsonRoutes)
    .route("/stations", stationsRoutes)
    .route("/stations", stationLinesRoutes)
    .route("/analytics", analyticsRoutes);
}

const app = createApp();

export type AppType = typeof app;

export default app;
