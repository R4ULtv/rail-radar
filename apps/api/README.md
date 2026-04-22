# Rail Radar API

Cloudflare Workers API that provides real-time European train data by scraping official sources.

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless deployment

## Endpoints

| Method | Path                          | Description                                                                                                                              |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/`                           | API info and endpoint documentation                                                                                                      |
| `GET`  | `/robots.txt`                 | Blocks crawlers from indexing the API                                                                                                    |
| `GET`  | `/operators`                  | List train operators with optional filtering                                                                                             |
| `GET`  | `/operators/:slug`            | Get a single train operator by slug                                                                                                      |
| `GET`  | `/map/static`                 | Static map image via Mapbox                                                                                                              |
| `GET`  | `/stations/search`            | Station search endpoint returning JSON arrays                                                                                            |
| `GET`  | `/stations.geojson`           | GeoJSON FeatureCollection of all stations (see below)                                                                                    |
| `GET`  | `/stations/trending`          | Get trending stations ranked by unique visitors (`?period=hour\|day\|week\|month`, default: `day`)                                       |
| `GET`  | `/stations/trending/:country` | Get country-filtered trending stations ranked by unique visitors (`it\|ch\|de\|fi\|be\|dk\|nl\|no\|se\|uk\|ie\`, same `?period` options) |
| `GET`  | `/stations/:id`               | Get station with trains (`?type=arrivals\|departures`)                                                                                   |
| `GET`  | `/stations/:id/stats`         | Get station visit stats (`?period=hour\|day\|week\|month`, default: `day`)                                                               |
| `GET`  | `/analytics/overview`         | Get global analytics (total visits, unique visitors, country breakdown)                                                                  |

### `GET /operators`

Returns a JSON object with `count` and `operators`.

- `?q=trenitalia`: text search across operator metadata
- `?country=it|international`: filter by served countries
- `?origin=it|international`: filter by operator origin country
- `?type=passenger|cargo|metro|light-rail`: filter by operator type
- `?serviceType=high-speed|intercity|regional|commuter|night-train|international|scenic`: filter by service type
- Comma-separated values are supported for filters like `?country=it,ch`

### `GET /operators/:slug`

Returns a single operator object for the requested slug, or `404` if it does not exist.

### `GET /stations/search`

Returns an `application/json` array of `Station` objects:

- `?q=roma`: plain-text prefix search by station name or alias (max 20 results)
- `?q=DE11160`: exact station ID lookup
- Empty or missing `q` returns an empty array
- One-character non-ID queries return an empty array
- Inline coordinate, country, and type parsing is not supported

### `GET /stations/trending`

Returns a JSON object with `timestamp`, `period`, and `stations`.

- Stations are ranked by `uniqueVisitors`, with `visits` used as a tie-breaker
- Each station still includes both `uniqueVisitors` and `visits`, so clients can show values like `20 (219)`
- `?period=hour|day|week|month` controls the analytics window
- `/stations/trending/:country` applies the same ranking within a single country

### `GET /stations.geojson`

Returns `application/geo+json` FeatureCollection consumed directly by Mapbox GL JS:

- No params: all stations (pre-serialized for performance)
- `?type=rail|metro|light`: filter by station type
- `?country=it|ch|de|fi|be|dk|nl|no|se|uk|ie`: filter by country
- Filters can be combined: `?type=rail&country=it`

### Caching

| Endpoint              | Cache                                   |
| --------------------- | --------------------------------------- |
| `/operators`          | 24h cache, 1h stale-while-revalidate    |
| `/operators/:slug`    | 24h cache, 1h stale-while-revalidate    |
| `/stations.geojson`   | 24h cache, 1h stale-while-revalidate    |
| `/stations/:id`       | 25s cache, 5s stale-while-revalidate    |
| `/stations/:id/stats` | 5min cache, 1min stale-while-revalidate |
| `/stations/trending`  | 5min cache, 1min stale-while-revalidate |
| `/analytics/overview` | 5min cache, 1min stale-while-revalidate |

### Rate Limiting

The `/stations/search` endpoint and `/stations/:id` endpoint are rate-limited per IP (15 requests per 10 seconds) using Cloudflare's Rate Limiting.

## Project Structure

```
src/
├── index.ts       # Main Hono app, route handlers, middleware
├── scrapers/
│   ├── index.ts       # Scraper router (selects by country prefix)
│   ├── fetch.ts       # Shared fetch helper (timeout, error handling)
│   ├── italy.ts       # RFI data scraper (HTML parsing)
│   ├── switzerland.ts # Swiss transport API scraper
│   ├── germany.ts     # German Deutsche Bahn API scraper
│   ├── finland.ts     # Finnish Digitraffic API scraper
│   ├── belgium.ts     # Belgian iRail API scraper
│   ├── netherlands.ts # Dutch NS API scraper
│   ├── norway.ts      # Norwegian Entur API scraper
│   ├── sweden.ts      # Swedish Trafiklab API scraper
│   ├── denmark.ts     # Danish Rejseplanen API scraper
│   ├── uk.ts          # UK National Rail API scraper
│   └── ireland.ts     # Irish Rail API scraper
├── analytics.ts   # Cloudflare Analytics Engine integration for visits and provider metrics
├── search.ts      # Deterministic station search
└── constants.ts   # Shared constants (cache TTL, timeouts, validation)
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm --filter=api dev
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm --filter=api deploy
```

Requires a Cloudflare account with Workers enabled. Configuration is in `wrangler.jsonc`.

Provider-backed scrapers require these Worker secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `MAPBOX_TOKEN`
- `NS_API_KEY`
- `LDBWS_API_KEY`
- `TRAFIKLAB_KEY`
- `REJSEPLANEN_API_KEY`

## Type Generation

To generate/synchronize types based on your Worker configuration:

```bash
pnpm --filter=api cf-typegen
```
