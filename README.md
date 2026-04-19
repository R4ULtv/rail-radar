[![Rail Radar](https://www.railradar24.com/og-image.webp)](https://www.railradar24.com)

## Features

- Interactive map with 15,000+ railway stations across Italy, Switzerland, Germany, Finland, Belgium, Denmark, the Netherlands, Norway, Sweden, the United Kingdom, and Ireland
- Real-time arrivals and departures from official data sources (RFI, SBB, DB, Digitraffic, iRail, Rejseplanen, NS, Entur, Trafiklab, LDBWS, Irish Rail)
- Station search with fuzzy matching
- Shareable URLs with map state
- User geolocation support
- Responsive mobile-friendly design

## Project Structure

| Directory                        | Description                              |
| -------------------------------- | ---------------------------------------- |
| [apps/api](./apps/api)           | Cloudflare Workers API for train data    |
| [apps/studio](./apps/studio)     | Admin tool for station data management   |
| [apps/web](./apps/web)           | Next.js frontend with interactive map    |
| [packages/data](./packages/data) | Shared station data and TypeScript types |
| [packages/ui](./packages/ui)     | Shared React component library           |

## Quick Start

```bash
# Install dependencies
pnpm install

# Run web + API in development
pnpm dev

# Run specific app
pnpm --filter=web dev    # Frontend at localhost:3000
pnpm --filter=api dev    # API server
pnpm --filter=studio dev # Admin tool at localhost:3001
```

## Scripts

| Command                        | Description                            |
| ------------------------------ | -------------------------------------- |
| `pnpm dev`                     | Start web and API development servers  |
| `pnpm --filter=studio dev`     | Start the admin tool at localhost:3001 |
| `pnpm build`                   | Build all packages                     |
| `pnpm lint --force`            | Lint all packages                      |
| `pnpm format`                  | Format code with oxfmt                 |
| `pnpm check-types --force`     | Run TypeScript type checking           |
| `pnpm --filter=api cf-typegen` | Generate Cloudflare Worker types       |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contributing Station Data

To add, edit, or remove train stations, use the [Rail Radar Studio](./apps/studio) tool. It provides an interactive map to:

- Add missing coordinates to stations
- Rename stations and fix typos
- Identify and merge duplicate stations
- Add new stations or remove invalid ones

See [apps/studio/README.md](./apps/studio/README.md) for detailed instructions.

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
- 🇩🇰 Danish train data from [Rejseplanen](https://www.rejseplanen.dk/)
- 🇩🇪 German train data from [Deutsche Bahn](https://www.bahn.de/) (DB)
- Map rendering by [Mapbox](https://www.mapbox.com/)
