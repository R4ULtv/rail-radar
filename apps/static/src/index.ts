import { Hono } from "hono";
import { getStationPhoto, getStationPhotos } from "./station-photos";

export type AppBindings = {
  ASSETS: Fetcher;
  RATE_LIMITER: RateLimit;
  STATION_IMAGES: R2Bucket;
};

const app = new Hono<{ Bindings: AppBindings }>();

app.get("/", (c) => {
  return c.json({
    name: "Rail Radar Static Assets",
    assetHost: "https://static.railradar24.com",
  });
});

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nDisallow: /");
});

app.use("/stations/:id/photo/*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.text("Too many requests. Please wait a moment and try again.", 429);
  }
  await next();
});

app.get("/stations/:id/photos", getStationPhotos);
app.get("/stations/:id/photo/*", getStationPhoto);

app.notFound((c) => c.text("Not found", 404));

app.onError((err, c) => {
  console.error("[Static Error]", { path: c.req.path, message: err.message });
  return c.text("Internal server error", 500);
});

export default app;
