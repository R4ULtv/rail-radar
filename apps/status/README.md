# Rail Radar Status

Status page for the Rail Radar API and the 15 upstream data providers behind its station boards. It shows whether the API responds, each provider's current health, and 30 days of history and response times.

## Tech Stack

- [Astro](https://astro.build/) 7 (static output) with one React island
- TanStack Query (polling), Recharts (latency chart, loaded on demand)
- Tailwind CSS 4 + shared components from `@repo/ui`
- Cloudflare Workers Static Assets via `@astrojs/cloudflare`

## Getting Started

Requires Node.js >=24.

```bash
pnpm --filter=status dev
```

Runs on [http://localhost:3002](http://localhost:3002) and reads the production API by default. To use a local API, run `pnpm --filter=api dev` and create `apps/status/.env.development.local`:

```dotenv
PUBLIC_API_URL=http://localhost:8787
```

The local API still needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Analytics Engine read access): it queries the account's collected data, and local writes never reach that dataset.

```bash
pnpm --filter=status check-types
pnpm --filter=status lint
pnpm --filter=status test
```

## Environment variables

| Variable         | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `PUBLIC_API_URL` | API base URL, set at build time. Defaults to `https://api.railradar24.com` |

## Cloudflare deployment

`cloudflare.config.ts` defines the `rail-radar-status` Worker and its custom domain, `status.railradar24.com`. `cf build` runs `astro build`, and the `@astrojs/cloudflare` adapter packages the prerendered page as an assets-only Worker in `.cloudflare/output/v0/`. The adapter's Images and session KV bindings are switched off in `astro.config.mjs`, since nothing renders at request time.

```bash
pnpm --filter=status exec cf auth login
pnpm --filter=status deploy
```

For CI, set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The API only allows CORS from `https://status.railradar24.com` and `http://localhost:3002`; add any other origin to its allowlist first.

## What the page shows

- **Rail Radar API** — one row with the result of a request to the API root from the visitor's browser: "Responding" or "Unverified", plus the response time (which includes the visitor's network). It is not a history or an uptime figure.
- **Data providers** — a headline, an "All / Needs attention" filter, and one row per provider with status, success rate, median response and last observation. "Needs attention" covers both failures and insufficient data.
- **Expanded provider** — description and links, any known issue or "new data source" notice, current figures, the split between visitor requests and scheduled checks, 30 daily status bars, and a p50 / p90 / p99 chart on a log scale.

Provider names, countries, descriptions and links live in `@repo/data/providers`. Known issues (`RAIL_DATA_WARNINGS`) and new data sources (`NEW_RAIL_DATA`, shown for 30 days) live in `@repo/data/countries` and are shared with the main website's station pages.

Provider logos and country flags load from the main website (`https://www.railradar24.com/assets/`); in development a Vite middleware serves the same files from `apps/web/public/assets`. A provider without artwork gets a neutral icon. See the [artwork sources](../web/public/assets/providers/SOURCES.md).

## Where the data comes from

Every provider fetch the API makes is written to the `provider_metrics` Analytics Engine dataset as a success, error or timeout, with its duration. There are two sources:

- **Visitor requests** — station boards opened on Rail Radar. Cached responses add nothing.
- **Scheduled checks** — an hourly cron in the API requests departures at one major station per provider (`PROBE_STATIONS` in `apps/api/src/provider-probes.ts`), so quiet providers still have data.

## Health rules

| Status            | Condition                               |
| ----------------- | --------------------------------------- |
| Operational       | Fewer than 5% of requests failed        |
| Degraded          | At least 5% failed                      |
| Major disruption  | At least 50% failed                     |
| Insufficient data | Fewer than 5 observations in the window |

- Errors and timeouts both count as failures.
- Current health uses the shortest of the last 1, 3 or 24 hours that has at least 5 observations, so busy providers reflect the last hour while quiet ones still get a status. Each row shows which window applied.
- Daily history applies the same rules per UTC day. Today is partial.
- Health describes requests observed through Rail Radar, not a guarantee of provider availability.

The thresholds live in `STATUS_POLICY` (`apps/api/src/provider-status.ts`) and the windows in `@repo/data/status`.

## API

The page reads two API routes; response types are in `@repo/data/status`. Both always return every configured provider, use the API's rate limiter, and return `503` if Analytics Engine fails or takes longer than 10 seconds.

| Route                 | Returns                                                           | Cache  | Page refresh |
| --------------------- | ----------------------------------------------------------------- | ------ | ------------ |
| `GET /status/summary` | Current health per provider from the adaptive window              | 60s    | 60s          |
| `GET /status/latency` | 30 UTC days per provider: counts, status and p50 / p90 / p99 ms | 15 min | 15 min       |

To limit Analytics Engine read queries, the cache ignores query strings, and after a failed read the route answers `503` from the edge for 30 seconds instead of querying again.

The page treats a summary or API check older than two minutes as unverified. If the summary fails, health is withdrawn while history stays visible; if history fails, the last loaded history stays with a warning.
