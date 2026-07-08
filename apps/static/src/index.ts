import { Hono } from "hono";
import { getStationPhoto, getStationPhotos } from "./station-photos";

export type AppBindings = {
  ASSETS: Fetcher;
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

app.get("/stations/:id/photos", getStationPhotos);
app.get("/stations/:id/photo/*", getStationPhoto);

app.notFound((c) => c.text("Not found", 404));

export default app;
