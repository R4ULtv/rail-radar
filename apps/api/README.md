# Rail Radar API

Cloudflare Workers API that provides real-time European train data by scraping official sources.

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless deployment

## Endpoints

| Method | Path                          | Description                                                                             |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| `GET`  | `/`                           | API info and endpoint documentation                                                     |
| `GET`  | `/map/static`                 | Static map image via Mapbox                                                             |
| `GET`  | `/stations`                   | GeoJSON FeatureCollection of all stations (see below)                                   |
| `GET`  | `/stations/trending`          | Get trending stations (`?period=hour\|day\|week`, default: `day`)                       |
| `GET`  | `/stations/trending/:country` | Get trending stations by country (`it\|ch\|fi\|be\|nl\|uk\|ie`, same `?period` options) |
| `GET`  | `/stations/:id`               | Get station with trains (`?type=arrivals\|departures`)                                  |
| `GET`  | `/stations/:id/stats`         | Get station visit stats (`?period=hour\|day\|week`, default: `day`)                     |
| `GET`  | `/analytics/overview`         | Get global analytics (total visits, unique visitors, country breakdown)                 |

### `GET /stations`

Returns station data in two formats depending on query parameters:

**GeoJSON mode** (default) — returns `application/geo+json` FeatureCollection consumed directly by MapBox GL JS:

- No params: all stations (pre-serialized for performance)
- `?type=rail|metro|light`: filter by station type
- `?country=it|ch|fi|be|nl|uk|ie`: filter by country
- Filters can be combined: `?type=rail&country=it`

**Search mode** — returns `application/json` array of `Station` objects:

- `?q=roma`: fuzzy search by station name (max 20 results)

### Caching

| Endpoint              | Cache                                   |
| --------------------- | --------------------------------------- |
| `/stations`           | 24h cache, 1h stale-while-revalidate    |
| `/stations/:id`       | 25s cache, 5s stale-while-revalidate    |
| `/stations/:id/stats` | 5min cache, 1min stale-while-revalidate |
| `/stations/trending`  | 5min cache, 1min stale-while-revalidate |
| `/analytics/overview` | 5min cache, 1min stale-while-revalidate |

### Rate Limiting

The `/stations` and `/stations/:id` endpoints are rate-limited per IP (15 requests per 10 seconds) using Cloudflare's Rate Limiting.

## Project Structure

```
src/
├── index.ts       # Main Hono app, route handlers, middleware
├── scrapers/
│   ├── index.ts       # Scraper router (selects by country prefix)
│   ├── fetch.ts       # Shared fetch helper (timeout, error handling)
│   ├── italy.ts       # RFI data scraper (HTML parsing)
│   ├── switzerland.ts # Swiss transport API scraper
│   ├── finland.ts     # Finnish Digitraffic API scraper
│   ├── belgium.ts     # Belgian iRail API scraper
│   ├── netherlands.ts # Dutch NS API scraper
│   ├── uk.ts          # UK National Rail API scraper
│   └── ireland.ts     # Irish Rail API scraper
├── analytics.ts   # Cloudflare Analytics Engine integration
├── fuzzy.ts       # Fuzzy search (Damerau-Levenshtein)
└── constants.ts   # Shared constants (cache TTL, timeouts, validation)
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

Requires a Cloudflare account with Workers enabled. Configuration is in `wrangler.jsonc`.

## Type Generation

To generate/synchronize types based on your Worker configuration:

```bash
pnpm cf-typegen
```
