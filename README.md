[![Rail Radar](https://www.railradar24.com/assets/social/og-image.webp)](https://www.railradar24.com)

## Features

- Interactive map with 21,000+ railway stations across Italy, Switzerland, Germany, Finland, Belgium, Denmark, the Netherlands, Norway, Sweden, Poland, the United Kingdom, Ireland, France, and Luxembourg
- Real-time arrivals and departures, where supported by each official source (RFI, SBB, DB, Digitraffic, iRail, Rejseplanen, NS, Entur, Trafiklab, PLK, LDBWS, Irish Rail, SNCF, Mobiliteit.lu)
- Station search with fuzzy matching
- Operator directory with network metadata and static coverage maps
- Trending stations ranked by unique visitors, with both unique and total visit counts available
- Shareable URLs with map state, saved stations, and recent stations
- User geolocation support
- Responsive mobile-friendly design

## Project Structure

| Directory                        | Description                              |
| -------------------------------- | ---------------------------------------- |
| [apps/api](./apps/api)           | Cloudflare Workers API for train data    |
| [apps/studio](./apps/studio)     | Admin tool for station data management   |
| [apps/web](./apps/web)           | TanStack Start frontend and media Worker |
| [packages/data](./packages/data) | Shared station data and TypeScript types |
| [packages/ui](./packages/ui)     | Shared React component library           |

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all development apps
pnpm dev

# Run specific app
pnpm --filter=web dev    # Frontend at localhost:3000
pnpm --filter=api dev    # API server
pnpm --filter=studio dev # Admin tool at localhost:3001
```

## Scripts

| Command                        | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `pnpm dev`                     | Start all development servers                 |
| `pnpm --filter=studio dev`     | Start the admin tool at localhost:3001        |
| `pnpm build`                   | Build all packages                            |
| `pnpm lint --force`            | Lint all packages                             |
| `pnpm format`                  | Format code with oxfmt                        |
| `pnpm check-types --force`     | Run TypeScript type checking                  |
| `pnpm --filter=api cf-typegen` | Generate API Worker types                     |
| `pnpm --filter=web cf-typegen` | Generate web Worker types                     |
| `pnpm --filter=api deploy`     | Deploy the API Worker to Cloudflare           |
| `pnpm --filter=web deploy`     | Build and deploy the web Worker to Cloudflare |

## Deployment Architecture

The public website runs on Cloudflare Workers using TanStack Start, Vite, and the Cloudflare Vite
plugin. The browser assets are deployed with the Worker through Cloudflare Workers Static Assets,
while request-time rendering and same-origin `/media/*` routes run in the Worker. The Hono API is a
separate Cloudflare Worker at `api.railradar24.com`.

The Studio app remains a separate SvelteKit application and uses the Cloudflare adapter for
production builds.

## Media Delivery

Shared media is served by [apps/web](./apps/web) on the same origin as the TanStack Start frontend.
Repo-owned media such as flags, operator logos, screenshots, and static social images is served
under `/assets/*` through Cloudflare Workers Static Assets. Generated images and R2-backed station
photos use same-origin `/media/*` routes; curated photos live in an EU Cloudflare R2 bucket and are
described by per-station manifests. See the
[web media delivery documentation](./apps/web/README.md#media-delivery) for the directory convention,
manifest template, image requirements, and upload workflow.

## Support

Rail Radar is free to use and independently maintained. If it's useful to you, you can help cover the API calls, hosting, and map tiles that keep it running.

[Donate via Polar](https://buy.polar.sh/polar_cl_tASj1xHmBWAiDQyuWr7zsyBSSFc9eUPZ9hwLy4cBlBN) — one-time, monthly, or yearly support. Also reachable from the in-app [/donate](https://www.railradar24.com/donate) page or the "Sponsor" button at the top of this repository.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, development workflow, quality checks, and pull request guidelines.

### Contributing Station Data

Station data contributions are supported through [Rail Radar Studio](./apps/studio). For the full workflow, see [CONTRIBUTING.md](./CONTRIBUTING.md) and [apps/studio/README.md](./apps/studio/README.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file.

## Acknowledgments

- 🇮🇹 Italian train data from [RFI](https://www.rfi.it/) (Rete Ferroviaria Italiana)
- 🇨🇭 Swiss train data from [transport.opendata.ch](https://transport.opendata.ch/)
- 🇫🇮 Finnish train data from [Digitraffic](https://www.digitraffic.fi/)
- 🇧🇪 Belgian train data from [iRail](https://docs.irail.be/) (NMBS/SNCB)
- 🇳🇱 Dutch train data from [NS](https://www.ns.nl/) (Nederlandse Spoorwegen)
- 🇬🇧 UK train data from [LDBWS](https://lite.realtime.nationalrail.co.uk/) (National Rail)
- 🇮🇪 Irish train data from [Irish Rail](https://www.irishrail.ie/) (Iarnród Éireann)
- 🇳🇴 Norwegian train data from [Entur](https://www.entur.no/)
- 🇸🇪 Swedish train data from [Trafiklab](https://www.trafiklab.se/)
- 🇵🇱 Polish train data from [PKP Polskie Linie Kolejowe](https://www.plk-sa.pl/) (PLK)
- 🇩🇰 Danish train data from [Rejseplanen](https://www.rejseplanen.dk/)
- 🇩🇪 German train data from [Deutsche Bahn](https://www.bahn.de/) (DB)
- 🇫🇷 French train data from [SNCF (Navitia)](https://numerique.sncf.com/startup/api/)
- 🇱🇺 Luxembourg train data from [Mobiliteit.lu](https://data.public.lu/en/datasets/api-mobiliteit-lu/)
- Map rendering by [Mapbox](https://www.mapbox.com/)
