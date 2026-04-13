import { factory } from "../lib/env";

const API_ENDPOINTS = {
  "GET /": "API structure and documentation",
  "GET /operators":
    "List train operators (optional: ?q=search&country=it|international&origin=international&type=passenger&serviceType=high-speed)",
  "GET /operators/:slug": "Get a train operator by slug",
  "GET /map/static":
    "Get a static map image (optional: ?bbox=west,south,east,north&w=960&h=412 or ?lat=...&lng=...&zoom=...)",
  "GET /stations/search": "Search stations by plain text or exact station ID (optional: ?q=roma)",
  "GET /stations.geojson":
    "Get stations as GeoJSON (optional: ?type=rail|metro|light&country=it|ch|de|fi|be|nl|no|se|uk|ie)",
  "GET /stations/trending": "Get trending stations (optional: ?period=hour|day|week, default: day)",
  "GET /stations/trending/:country":
    "Get trending stations by country (it|ch|de|fi|be|nl|no|se|uk|ie, optional: ?period=hour|day|week)",
  "GET /stations/:id/stats":
    "Get station visit stats (optional: ?period=hour|day|week, default: day)",
  "GET /stations/:id": "Get station info with trains (optional: ?type=arrivals|departures)",
  "GET /analytics/overview": "Get global analytics overview",
} as const;

export const rootRoutes = factory
  .createApp()
  .get("/", (c) => {
    return c.json({
      name: "Rail Radar API",
      version: "1.0.0",
      endpoints: API_ENDPOINTS,
    });
  })
  .get("/robots.txt", (c) => {
    return c.text("User-agent: *\nDisallow: /");
  });
