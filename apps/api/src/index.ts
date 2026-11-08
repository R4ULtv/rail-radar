import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { factory, type Bindings } from "./lib/env";
import { logRequestError } from "./lib/error-logging";
import { jsonError } from "./lib/http";
import { runProviderProbes } from "./provider-probes";
import { analyticsRoutes } from "./routes/analytics";
import { linesGeoJsonRoutes, linesRoutes, stationLinesRoutes } from "./routes/lines";
import { mapRoutes } from "./routes/map";
import { operatorsRoutes } from "./routes/operators";
import { rootRoutes } from "./routes/root";
import { stationsGeoJsonRoutes } from "./routes/stations-geojson";
import { stationsRoutes } from "./routes/stations";
import { statusRoutes } from "./routes/status";

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
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "https://status.railradar24.com",
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
    .route("/analytics", analyticsRoutes)
    .route("/status", statusRoutes);
}

export const app = createApp();

export type AppType = typeof app;

export default {
  fetch: app.fetch,
  // Cron: one synthetic request per provider, so quiet providers still have status data.
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runProviderProbes(env));
  },
} satisfies ExportedHandler<Bindings>;
