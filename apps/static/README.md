# Rail Radar Static Assets

Cloudflare Worker for shared Rail Radar media, served from `static.railradar24.com`.

This app is the dedicated home for reusable media that should not be coupled to a specific frontend deployment. It currently uses Cloudflare Workers Static Assets for small, repo-owned files and keeps a minimal Hono Worker in place so asset delivery can grow without a redesign later.

## Responsibilities

### Current

- Serve small, repo-owned, versioned assets from `public/` through Cloudflare Workers Static Assets.
- Provide a stable shared asset host for the web app, studio, and future clients.
- Keep shared media delivery separate from the Next.js deployment lifecycle.
- Apply browser cache headers for shared assets through `public/_headers`.

### Future

- Bind an R2 bucket for larger or growing media collections, especially station images.
- Serve R2-backed station photos alongside repo-owned static assets from the same dedicated media domain.
- Add asset-specific behavior later if needed, such as redirects, manifests, fallback handling, or differentiated cache policy.

## Asset Strategy

| Asset type | Storage | Examples |
| --- | --- | --- |
| Small, repo-owned, versioned files | Workers Static Assets | flags, operator logos, screenshots, shared UI images |
| Larger, growing media collections | Future R2 bucket | station photos |

This split keeps the first implementation simple while leaving a clean path for future station-image growth.

## Layout

```text
apps/static/
├── public/
│   ├── _headers/            # Browser cache policy for static files
│   ├── flags/               # Country flags
│   ├── operators/           # Operator and brand logos
│   ├── screenshots/         # Shared product screenshots
│   └── station-icon.png     # Shared map marker image used by the API
├── src/index.ts             # Minimal Hono Worker
└── wrangler.jsonc           # Worker, domain, and Static Assets configuration
```

Web-app-specific files such as favicon/app icons and web metadata imagery stay in `apps/web/public` when they are tightly coupled to the web app itself.

## Local Development

```bash
pnpm --filter=static dev
```

The static Worker is configured to use:

- Worker server: `http://127.0.0.1:8788`
- Inspector: `127.0.0.1:9230`

Those ports intentionally differ from the API Worker so both Workers can run locally at the same time.

## Deployment

```bash
pnpm --filter=static deploy
```

Wrangler uploads `public/` as Cloudflare Workers Static Assets during deployment. The production route is configured as `static.railradar24.com` in `wrangler.jsonc`.

## Type Generation

After changing `wrangler.jsonc`, regenerate Worker bindings:

```bash
pnpm --filter=static cf-typegen
```

When the future R2 bucket is introduced, its binding should be added to `wrangler.jsonc` and reflected in the generated Worker types before implementing station-image routes.
