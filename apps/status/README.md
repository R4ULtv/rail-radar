# Rail Radar status

A separate **Astro + React** status app. Astro builds the page shell to static HTML; one React island handles live requests, filtering, and accessible expandable provider rows. The layout follows the selected Paper design and Rail Radar's shared visual language. It can be hosted independently of the map and API, with no new backend, database, or OpenStatus service. The API's cron (below) supplies scheduled provider checks.

The app imports Accordion, Alert, Badge, Button, Empty, Skeleton, ToggleGroup, Tooltip, and Chart directly from `@repo/ui`. It does not maintain copies of those components. Recharts loads when a service with latency data is expanded. The status logo and licensed Geist fonts are local. Provider logos and country flags use the main website’s canonical assets. Names remain readable if shared artwork is unavailable; provider tiles fall back to a neutral network icon. Flags appear beside country names, rather than representing the provider itself.

The page uses the shared UI's dark theme from the initial HTML, with dark-appropriate status and chart colors. The status site's own `public/favicon.svg` is used in the footer, browser tab, and API service row. There is no header bar: the page opens with a "Back to Rail Radar" link styled like the one on the main website's `/operators` page, then its title. Links to the main website and Reports are also in the footer. Provider rows use quiet hover highlighting without underlines; headings and expanded rows share the page’s dark surface. The footer carries the brand and those two links. Each expanded provider describes the provider, links to its website and to its country's station directory (using the shared country slugs), and shows any known data issue for that country.

Use Node >=22.23.4, as required by Astro 7. This workspace uses TypeScript 6 to match `@astrojs/check`'s supported peer range; other workspaces keep their existing compiler versions.

## Development

From the repository root:

```sh
pnpm install
pnpm --filter=api cf-typegen
pnpm --filter=api dev
pnpm --filter=status dev
```

The status app runs at `http://localhost:3002`. It reads `https://api.railradar24.com` by default. To use the local API during development, create `apps/status/.env.development.local`:

```dotenv
PUBLIC_API_URL=http://localhost:8787
```

**The API must include the new status routes.** An existing deployment without them returns 404 and the page displays an unavailable state.

The API read side uses the existing server-side `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets. The token needs Analytics Engine read access for the account containing `provider_metrics`. Local Analytics Engine writes do not populate the remote dataset: local reads still require credentials and query the account's collected data. No secret is needed in the status app; `PUBLIC_API_URL` is public build-time configuration. This replaces the former Vite `VITE_API_URL` setting; the existing worktree's local status configuration was migrated. Keep localhost overrides in the development-only file so a production build uses the public API by default.

Restart the status dev server after migrating from Vite. `pnpm --filter=api --filter=status dev` runs both services.

## Shared artwork

Production flags and logos load from `https://www.railradar24.com/assets/`. Updating a shared asset at its existing URL does not require rebuilding or redeploying the status app (the main website’s asset cache lifetime still applies). Locally, a development-only Vite middleware serves the exact files under `apps/web/public/assets` at `/__shared-assets/`; no duplicate flags or provider artwork are included in the status build, and the main web app does not need to be running. Only recognized image paths and GET/HEAD requests are served.

The 10 new provider assets must be published with the main website before their production URLs are available; the status app has a neutral fallback until then. No deployment has been performed. Five existing operator logos are reused unchanged. [Artwork sources and verification](../web/public/assets/providers/SOURCES.md) document all provider identities, including the original raster icons retained where no suitable official compact vector was recovered.

## Rail Radar and upstream providers

Rail Radar API is the first service, followed by the 15 upstream data providers. While the page is open, it requests the API root independently of analytics and verifies the expected Rail Radar response. A successful recent response displays “Responding”; a failed or stale observation displays “Unverified”. The response time includes the visitor's network. No API uptime percentage or history is inferred from provider fetches.

This is a visitor-triggered reachability read, not a scheduled synthetic check. An Analytics Engine failure can leave the API reachable while provider health is unverified. The page keeps Rail Radar’s own section to a single row: only the latest reachability status and response time, with no expandable API report, request counters, historical status, or API latency graph. Provider history and latency are the focus.

Provider descriptions and website links live in `PROVIDER_DETAILS` (`@repo/data/providers`), which is kept out of API responses. Known issues come from `RAIL_DATA_WARNINGS` (`@repo/data/countries`), the same list the main website shows on rail station pages, so adding or removing a country's warning updates both. A provider with a known issue has a warning mark in its collapsed row (also announced in its accessible name) and a "Known issue" notice when expanded. Known issues do not affect observed health or the "Needs attention" filter.

Recently added data sources are listed in `NEW_RAIL_DATA` (`@repo/data/countries`) with their go-live date. For `NEW_RAIL_DATA_DAYS` (30) days the provider row shows a "New" pill and an expanded "New data source" notice, and the main website shows the same notice on that country's rail station pages (a known issue takes precedence there). The flag lapses on its own; delete the entry afterwards. Prerendered HTML includes listed countries, and the client drops the flag after mount once it has lapsed, so hydration always matches.

Provider rows are collapsed initially. A collapsed row shows status, success rate (with the request count and window), median response, and the last observation. Expanding a row shows its description and links, any known issue, three current figures (success rate, failed requests, last observed), the traffic-source split, 30 daily health buckets (today, still partial, is drawn as a lighter outlined bar), and a p50/p99/p99.9 chart. The chart uses a log scale with 1-3-10 ticks fitted to the data: medians sit around 40 ms to 2 s while failed requests record timings at the timeout (about 12 s), and a linear axis would flatten p50 against those spikes. p99.9 is dashed and drawn over p99, which it often equals on small samples. The methodology section at the foot of the page carries the measurement notes, so expanded rows have no footnotes. The provider headline sits under the section title beside the filter and Refresh; there is no separate per-status count strip. “Needs attention” includes both known failures and insufficient data. The collapsed median is dated only when its latest timed day is not today, so an older observation is not presented as today's timing.

## API contract

Both routes always return every configured provider, including those without data. Provider IDs, display names, and countries live in `@repo/data/providers`; response types live in `@repo/data/status`. Both routes count `blob2 IN ('live', 'synthetic')` (visitor requests and scheduled probes), combine arrivals/departures, use the API's existing rate limiter, and return a non-cacheable 503 if provider analytics fails or exceeds the 10-second query timeout. To limit Analytics Engine read queries (metered per account), the edge cache key ignores query strings, and after a failed read the route answers 503 from the edge for 30 seconds instead of querying again. Unknown data is distinct from a failed query. The top-level `overall`, `counts`, and `scope` describe providers only.

### `GET /status/summary`

Observed provider health from an adaptive window. Each provider uses the shortest of the last 1, 3, or 24 hours with at least 5 actual observations, so busy providers reflect problems within the hour, while low-traffic providers whose station boards may only be requested a few times a day still receive a status. If no window has enough observations, the provider reports the full 24 hours as `unknown`. Every count, `successRate`, and `status` for a provider describe its `windowMinutes`. The top-level `window` is the outer 24-hour range. Cached for 60 seconds.

With the traffic observed in early November 2026, the last hour has enough observations for the busiest providers about half to two-thirds of the time, the last 3 hours covers most mid-traffic providers, and the quietest providers (Digitraffic, Mobiliteit, MÁV) usually fall back to 24 hours or remain unknown. The thresholds and window list live in `STATUS_POLICY` and `STATUS_SUMMARY_WINDOWS_MINUTES`.

```json
{
  "generatedAt": "2026-11-06T12:00:00.000Z",
  "source": "live",
  "scope": "provider-fetches",
  "window": {
    "from": "2026-11-05T12:00:00.000Z",
    "to": "2026-11-06T12:00:00.000Z",
    "minutes": 1440
  },
  "policy": { "minSamples": 5, "degradedFailureRate": 0.05, "outageFailureRate": 0.5 },
  "overall": "unknown",
  "counts": { "operational": 1, "degraded": 0, "outage": 0, "unknown": 14 },
  "providers": [
    {
      "id": "rfi",
      "name": "RFI",
      "country": "it",
      "requests": 100,
      "successes": 99,
      "errors": 0,
      "timeouts": 1,
      "samples": 100,
      "syntheticRequests": 1,
      "syntheticSuccesses": 1,
      "successRate": 0.99,
      "status": "operational",
      "windowMinutes": 60,
      "lastSeen": "2026-11-06T11:59:50.000Z"
    }
  ]
}
```

The example abbreviates the provider array. `windowMinutes` is `60`, `180`, or `1440`. `lastSeen` is the latest observation **within the outer 24-hour window**, or `null`, regardless of which window was used for health. The page displays both the date and time, so observations from yesterday remain distinguishable from fresh traffic. `successRate` is a fraction from 0 to 1, or `null` when there are no requests. The windows are shared by the API and app via `STATUS_SUMMARY_WINDOWS_MINUTES` (the outer window is `STATUS_SUMMARY_WINDOW_MINUTES`); labels use each provider's actual `windowMinutes`. The summary is a single Analytics Engine query with one set of conditional sums per window.

### `GET /status/latency`

The current UTC day and the preceding 29 days, cached for 15 minutes (daily buckets change slowly, and each refresh costs two Analytics Engine queries). The response contains `generatedAt`, `source: "live"`, `timezone: "UTC"`, `unit: "ms"`, `window: { from, to, days: 30 }`, `policy`, and `providers: [{ id, name, country, days }]`.

Each provider has exactly 30 chronological daily buckets:

```json
{
  "date": "2026-11-06",
  "partial": true,
  "requests": 100,
  "successes": 99,
  "errors": 0,
  "timeouts": 1,
  "samples": 100,
  "syntheticRequests": 24,
  "syntheticSuccesses": 24,
  "successRate": 0.99,
  "status": "operational",
  "latency": { "p50": 180, "p99": 900, "p999": 1200 },
  "latencySamples": 99,
  "latencyRequests": 99
}
```

Missing days have zero counts, `status: "unknown"`, `successRate: null`, and all three latency values `null`. Today has `partial: true`; its range ends at generation time. The graphs show gaps instead of connecting missing days. Recorded zero-millisecond timings are valid. Failures without timings still affect health, while the writer's `-1` sentinel never enters latency calculations.

## Scheduled provider probes

The API Worker has a Cron Trigger (`0 * * * *` in `apps/api/cloudflare.config.ts`). Each run calls every provider's scraper once for departures at a fixed top-importance hub (`PROBE_STATIONS` in `apps/api/src/provider-probes.ts`, e.g. Roma Termini, Zürich HB, London Euston, Budapest-Keleti), in parallel and bypassing the station cache. Each outcome is written to `provider_metrics` like a live request, with `blob2 = 'synthetic'` and the same success/error/timeout classification, so the two sources can still be separated in Analytics Engine.

Hourly is 24 probes a day, so even a provider with no visitor traffic reaches the 5-observation minimum in the status page's 24-hour window (3 probes per 3 hours are not enough on their own); busier providers also get live observations on top and can use the 1- or 3-hour window. The cost is 24 upstream requests per provider per day (360 in total). A probe failure is logged as a warning (`Provider probe failed`) and recorded, never retried. Probes count toward health and latency alike, and a hub board measures a busy station rather than the average one.

Trigger a run locally with `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+*+*+*+*"` while `pnpm --filter=api dev` is running. Local runs hit the real upstreams but, like all local Analytics Engine writes, do not reach the remote dataset.

## Health semantics

- At least **5 actual observations** are required before assigning health, both for the adaptive summary window and each daily bucket. An operational summary describes successful observed traffic during that period; it does not imply the provider was checked just now. A provider that falls back to 3 or 24 hours can still hide a brief incident; the row and expanded details show which window applies, alongside the last observation and history.
- Failures include both errors and timeouts. A failure rate below 5% is `operational`, at least 5% is `degraded`, and at least 50% is `outage` (displayed as “Major disruption”). Fewer than 5 observations is `unknown`, even if the weighted request count is large.
- The page headline gives an all-clear (“All observed providers are healthy”) when no provider is degraded or in outage and at least one is operational, noting how many providers had too little recent traffic. Quiet providers lack data rather than failing, so they no longer hold back the headline; it waits only when no provider has enough observations.
- The API's `overall` field is stricter: it is `outage` only when every provider is in outage, `degraded` if any provider has a known issue, `unknown` if any provider lacks enough data and none has a known issue, and `operational` only when every provider is operational.
- Requests and outcome counts use `sum(_sample_interval)`. Percentiles use `quantileExactWeighted` on recorded fetch durations, weighted by `_sample_interval`. `syntheticRequests` and `syntheticSuccesses` are the part of `requests` and `successes` from scheduled checks (`blob2 = 'synthetic'`); the rest came from visitors. The page shows this split in each provider's “Traffic sources” and stripes days observed only through checks. `samples` and `latencySamples` are actual stored row counts; `latencyRequests` is the estimated request count with valid timings. High tail percentiles on small samples are descriptive, not reliable tail estimates.
- Health describes **requests observed through Rail Radar**, not guaranteed provider availability. Cache hits, API errors before a provider fetch, and API outages do not produce provider observations; scheduled probes keep quiet providers from going without any. Rail Radar's “Responding” state only confirms a recent successful API-root response; it is not a historical API uptime claim.
- API reachability, summary, and history refresh independently. Reachability and summary refresh each minute; history refreshes every 15 minutes. On summary refresh failure, current health becomes unverified while history stays visible. Failed history refreshes preserve available history with a warning. The page rejects reachability and summary observations older than two minutes, including while polling is paused offline.

## Build and hosting

```sh
pnpm --filter=status check-types
pnpm --filter=status lint
pnpm --filter=status test
pnpm --filter=status build
pnpm --filter=status start
```

Deploy `apps/status/dist` to static hosting, or run `pnpm --filter=status deploy` after building to deploy the dedicated `rail-radar-status` static-assets Worker. The Wrangler configuration does not claim a custom domain. The API allows CORS for `https://status.railradar24.com` and localhost port 3002; configure your chosen custom domain to match, or add its exact origin to the API allowlist before deploying elsewhere.

`astro check` checks both the page template and TypeScript/React components. The frontend tests cover accordion expansion, the compact API status, provider history, filtering, sparse data, expiry, shared artwork fallbacks, and independent reachability/analytics failures. API tests cover one write per response, cached station requests versus provider fetches, sanitized route labels, handled failures, telemetry failures, weighted API health, client errors, and partial analytics availability. The API and app are prepared in the main worktree; production deployment is a separate action.
