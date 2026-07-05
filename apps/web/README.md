# Rail Radar Web

Next.js frontend for real-time train tracking across Europe with an interactive map interface.

## Tech Stack

- [Next.js 16](https://nextjs.org/) + React 19
- [Mapbox GL](https://www.mapbox.com/mapbox-gljs) via react-map-gl - Interactive mapping
- [SWR](https://swr.vercel.app/) - Data fetching with auto-refresh
- [nuqs](https://nuqs.47ng.com/) - URL query state sync
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [Base UI](https://base-ui.com/) - Component primitives

## Features

- Interactive full-screen map with 21,000+ station markers
- Real-time train arrivals/departures with 30s polling
- Fuzzy station search with keyboard shortcuts
- URL-synced map state for shareable links
- Operator directory and station detail pages with static maps
- Saved stations and recent stations in localStorage
- User geolocation with animated marker
- Responsive design for mobile and desktop

## Environment Variables

| Variable                   | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | The base endpoint for the backend API (e.g., `https://api.railradar24.com`)      |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public Mapbox access token required to initialize map components and tiles       |
| `NEXT_PUBLIC_SITE_URL`     | Public site URL used for Open Graph meta tags and canonical URLs                 |
| `MAPBOX_SERVER_TOKEN`      | Server-side Mapbox token used to render Open Graph map images                    |
| `NEXT_PUBLIC_STATIC_URL`   | Static site URL used for the static assets                                       |
| `NEXT_PUBLIC_POSTHOG_KEY`  | PostHog project API key (EU cloud); events are proxied through t.railradar24.com |

## Development

```bash
# Install dependencies
pnpm install

# Start development server (localhost:3000)
pnpm --filter=web dev
```

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── operators/          # Operator directory and detail pages
│   ├── station/[id]/       # Station detail pages
│   ├── og/route.tsx        # Dynamic Open Graph image route
│   ├── layout.tsx
│   └── page.tsx            # Main map experience
├── components/
│   ├── map.tsx             # Main map component
│   ├── map-controls.tsx    # Zoom, locate, compass controls
│   ├── map-loading.tsx     # Map loading skeleton
│   ├── save-button.tsx     # Saved station control
│   ├── search.tsx          # Station search
│   ├── static-map.tsx      # Static Mapbox image component
│   ├── station-info.tsx    # Station details drawer
│   ├── station-markers.tsx # GeoJSON marker layer
│   ├── train-row.tsx       # Train list item
│   ├── brands.tsx          # Train brand logo resolver
│   └── station-page/       # Station detail page components
│       ├── nearby-stations.tsx
│       ├── station-header.tsx
│       ├── station-stats.tsx
│       ├── train-board.tsx
│       └── train-column.tsx
├── hooks/
│   ├── use-recent-stations.tsx
│   └── use-saved-stations.tsx
└── lib/
    └── api/                # API client and types
```

## Deployment

Deploy to [Vercel](https://vercel.com) or any platform that supports Next.js.

```bash
pnpm build
```
