# Rail Radar Static Assets

Cloudflare Worker dedicated to shared Rail Radar media served from `static.railradar24.com`.

## Responsibilities

- Serve small, repo-owned, versioned assets from `public/` using Cloudflare Workers Static Assets.
- Keep a minimal Hono Worker available for future asset-specific behavior.
- Leave room for a future R2 binding for larger, growing media collections such as station images.

## Layout

- `public/brands/` — operator and brand logos
- `public/flags/` — country flags
- `public/screenshots/` — shared product screenshots
- `public/*.webp|*.png` — other shared media assets

## Development

```bash
pnpm --filter=static dev
```

## Deployment

```bash
pnpm --filter=static deploy
```

Static Assets are configured in `wrangler.jsonc`; Wrangler uploads `public/` with the Worker deployment.
