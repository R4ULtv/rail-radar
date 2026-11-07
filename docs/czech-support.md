# Czech support verification

Verified 7 November 2026 on `feat/czech-support`.

## Integration

- 2,593 passenger stations from GRAPP, matched against official CIS passenger-station names and the SR70 directory.
- Seven-digit CIS identifiers, including `CZ5453613` (Pardubice hlavní nádraží), `CZ5457076` (Praha hlavní nádraží), and `CZ5433295` (Brno hlavní nádraží).
- Separate arrivals/departures parsing, same-request token/cookie pairing, midnight delays, and disruption notices attached to their train.
- Eight observed carrier codes resolve to operator entries and existing or new SVG assets: `ČD`, `RJET`, `RJÚK`, `ARR`, `LEO`, `GWTR`, `AŽD`, `DLB`.
- Czech coverage added to ČD, Arriva, Leo Express, and RegioJet; native Czech origin added for ČD, Leo Express, and RegioJet.
- The prior local workerd and temporary Cloudflare Worker checks returned live train arrays for Pardubice, Praha, Brno and Blatec. The test Worker was deleted after verification. Production was not deployed.

Station regeneration and source limitations are documented in the [data README](../packages/data/README.md#czech-stations).

## Official logo sources

All three tiles use a white background, a 64 × 64 canvas, original vector contours and brand colors. No generated artwork, substitute sister brand, bitmap tracing or external fonts are used.

### GW Train Regio

- Asset: [gw-train-regio.svg](../apps/web/public/assets/operators/cz/gw-train-regio.svg).
- [Official vector](https://www.gwtr.cz/images/front/logo-new.svg), used on the [operator's website](https://www.gwtr.cz/).
- Selected the complete orange `GW` monogram from the main lockup, omitting `TRAIN` and the group tagline. Original orange: `#e84e0f`.
- Operator metadata: [legal information](https://www.gwtr.cz/cs/o-spolecnosti/povinne-informace), [history and ownership](https://www.gwtr.cz/cs/o-spolecnosti/historie), and official [Karlovarsko](https://www.gwtr.cz/cs/karlovarsko), [Královéhradecko](https://www.gwtr.cz/cs/kralovehradecko), and [Moravskoslezsko](https://www.gwtr.cz/cs/moravskoslezsko) service pages.

### AŽD Praha

- Asset: [azd.svg](../apps/web/public/assets/operators/cz/azd.svg).
- [Official RGB Illustrator vector](https://www.azd.cz/admin-data/storage/get/2007-azd-rgb.ai), linked from the [official logo downloads](https://www.azd.cz/cs/media/loga).
- Retained the complete winged wheel and integral AŽD lettering. Extracted the vector paths from the PDF-compatible Illustrator document, removing only the artboard whitespace. Blue `#004872` and yellow `#ffd100` match the published RGB specification and [brand manual](https://www.azd.cz/admin-data/storage/get/1909-azd_logomanual_v2_2022_1_web.pdf).
- Operator metadata: [AŽD Vlaky passenger services](https://www.azdvlaky.cz/cs) and [company history](https://www.azd.cz/cs/o-spolecnosti/historie-azd). The founding year follows the company's stated 1954 origins.

### Die Länderbahn CZ

- Asset: [die-laenderbahn-cz.svg](../apps/web/public/assets/operators/cz/die-laenderbahn-cz.svg).
- [Official vector](https://www.laenderbahn.com/assets/base/img/logos/laenderbahn.svg), used directly on the [Czech company's own site](https://www.laenderbahn.com/cs/onas/die-landerbahn-cz/).
- Retained the complete striped symbol, including its white region and original outline; omitted the long company wordmark. Original blue: `#214e8b`. Expanded the source viewBox during extraction to preserve the thin outline at the original artboard edge.
- Operator metadata: [company profile](https://www.laenderbahn.com/cs/onas/die-landerbahn-cz/), [registered address](https://www.laenderbahn.com/cs/pravni-informace/identifikacni-udaje-2/), [current service information](https://www.laenderbahn.com/cs/), and the infrastructure manager's [T7 timetable](https://www.spravazeleznic.cz/documents/50004227/191473899/k137.pdf/50c0af37-a83b-4038-be13-562e981a727e).

Operator map bounds are conservative coverage envelopes around the published routes, rather than precise track geometries. Unknown network lengths and passenger totals remain null.

## Geometry and rendering

Measurements were made **after SVGO optimization**, rendering at 2048 px on transparency with resvg and measuring nontransparent artwork. Values below are in 64-unit canvas coordinates, with a raster resolution of 0.03125 units. Only the tile's CSS background was removed for measurement; the symbols' own white regions and outlines were retained.

| Asset             | Artwork width × height | Artwork center  | Offset from (32, 32) |
| ----------------- | ---------------------- | --------------- | -------------------- |
| GW Train Regio    | 50.8125 × 21.4375      | (32, 32)        | (0, 0)               |
| AŽD Praha         | 50.8125 × 33.875       | (32, 32)        | (0, 0)               |
| Die Länderbahn CZ | 50.78125 × 27.8125     | (32.015625, 32) | (+0.015625, 0)       |

All artwork fits below the 51-unit cap with margin for raster uncertainty. The Länderbahn center difference is below one raster pixel; no deliberate optical offset was applied. Complete tiles were inspected offline at 64 px and 32 px, with their white CSS background composited for the preview. No clipping, broken references, missing white regions or unreadable long wordmarks were found.

## Checks

- API: **1,118 tests pass across 34 files**, including Czech boards, search, scraper/provider registration and Czech operator directory filtering.
- Typechecks: API source and tests, web, and shared data pass.
- Lint: API, web, and shared data pass with warnings denied.
- Formatter: all changed supported source/data/documentation files pass.
- Data importer: `python3 scripts/import-czech-stations.py --check` validates count, unique IDs, code map parity and Czech coordinate bounds.
- SVG optimizer: explicit targets with `--multipass --check` report **0/3 would change**.
- All eight observed GRAPP carrier codes resolve to existing logo files and Czech-tagged directory entries.

The feature is isolated from the separate Cloudflare configuration migration in the original checkout. Its worktree uses the declared stable Vite plugin version and ignored, locally generated API binding types; dependency setup did not change package manifests or the lockfile.
