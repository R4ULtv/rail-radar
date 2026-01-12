# Rail Radar API

Cloudflare Workers API that provides real-time Italian railway data by scraping official RFI sources.

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless deployment
- [Cheerio](https://cheerio.js.org/) - HTML parsing for scraping

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API info and endpoint documentation |
| `GET` | `/stations` | List all stations (optional: `?q=search`) |
| `GET` | `/stations/:id` | Get station by ID |
| `GET` | `/trains/:stationId` | Get arrivals/departures (optional: `?type=arrivals\|departures`) |

### Caching

Train data is cached for 30 seconds with stale-while-revalidate to reduce load on upstream sources.

### Rate Limiting

The `/trains/:stationId` endpoint is rate-limited per IP using Cloudflare's Rate Limiting.

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
