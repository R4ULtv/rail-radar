import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { factory } from "./lib/env";
import { jsonError } from "./lib/http";
import { analyticsRoutes } from "./routes/analytics";
import { mapRoutes } from "./routes/map";
import { operatorsRoutes } from "./routes/operators";
import { rootRoutes } from "./routes/root";
import { stationsGeoJsonRoutes } from "./routes/stations-geojson";
import { stationsRoutes } from "./routes/stations";

export function createApp() {
  const app = factory.createApp();

  app.onError((err, c) => {
    console.error("[API Error]", {
      path: c.req.path,
      method: c.req.method,
      message: err.message,
    });

    return jsonError(c, "Internal server error", 500);
  });

  app.notFound((c) => {
    return jsonError(c, "Not found", 404);
  });

  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
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
    .route("/map", mapRoutes)
    .route("/stations.geojson", stationsGeoJsonRoutes)
    .route("/stations", stationsRoutes)
    .route("/analytics", analyticsRoutes);
}

const app = createApp();

export type AppType = typeof app;

export default app;
