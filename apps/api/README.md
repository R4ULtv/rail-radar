# Rail Radar API

Cloudflare Workers API that provides real-time Italian railway data by scraping official RFI sources.

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless deployment

## Endpoints

| Method | Path                  | Description                                                         |
| ------ | --------------------- | ------------------------------------------------------------------- |
| `GET`  | `/`                   | API info and endpoint documentation                                 |
| `GET`  | `/stations`           | List all stations (optional: `?q=search`)                           |
| `GET`  | `/stations/trending`  | Get trending stations (`?period=hour\|day\|week`, default: `day`)   |
| `GET`  | `/stations/:id`       | Get station with trains (`?type=arrivals\|departures`)              |
| `GET`  | `/stations/:id/stats` | Get station visit stats (`?period=hour\|day\|week`, default: `day`) |
| `GET`  | `/analytics/overview` | Get global analytics (total visits, unique visitors, etc.)          |
| `GET`  | `/rfi/status`         | Get RFI request timing stats (`?period=hour\|day\|week`)            |

### Caching

Responses are cached to reduce load on upstream sources:

- `/stations/:id`: 25s cache, 5s stale-while-revalidate
- `/stations/:id/stats`: 5min cache, 1min stale-while-revalidate
- `/stations/trending`: 5min cache, 1min stale-while-revalidate
- `/analytics/overview`: 5min cache, 1min stale-while-revalidate
- `/rfi/status`: 5min cache, 1min stale-while-revalidate

### Rate Limiting

The `/stations` and `/stations/:id` endpoints are rate-limited per IP (15 requests per 10 seconds) using Cloudflare's Rate Limiting.

## Project Structure

```
src/
├── index.ts      # Main Hono app, route handlers, middleware
├── scraper.ts    # HTML parsing with HTMLRewriter for RFI data
├── analytics.ts  # Cloudflare Analytics Engine integration
├── fuzzy.ts      # Fuzzy search (Damerau-Levenshtein)
└── constants.ts  # Shared constants (cache TTL, timeouts, validation)
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
