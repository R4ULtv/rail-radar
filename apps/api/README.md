# Rail Radar API

Cloudflare Workers API that provides real-time Italian railway data by scraping official RFI sources.

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless deployment
- [Cheerio](https://cheerio.js.org/) - HTML parsing for scraping

## Endpoints

| Method | Path                  | Description                                                        |
| ------ | --------------------- | ------------------------------------------------------------------ |
| `GET`  | `/`                   | API info and endpoint documentation                                |
| `GET`  | `/stations`           | List all stations (optional: `?q=search`)                          |
| `GET`  | `/stations/trending`  | Get trending stations (`?period=hour\|day\|week`, default: `day`)  |
| `GET`  | `/stations/:id`       | Get station with trains (`?type=arrivals\|departures`)             |
| `GET`  | `/analytics/overview` | Get global analytics (total visits, unique visitors, etc.)         |

### Caching

Responses are cached to reduce load on upstream sources:

- `/stations/:id`: 25s cache, 5s stale-while-revalidate
- `/stations/trending`: 10min cache, 1min stale-while-revalidate
- `/analytics/overview`: 10min cache, 1min stale-while-revalidate

### Rate Limiting

The `/stations/:id` endpoint is rate-limited per IP using Cloudflare's Rate Limiting.

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
