import { Hono } from "hono";

type Bindings = {
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.json({
    name: "Rail Radar Static Assets",
    assetHost: "https://static.railradar24.com",
  });
});

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nDisallow: /");
});

app.notFound((c) => c.text("Not found", 404));

export default app;
