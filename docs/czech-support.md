# Czech support verification

Verified 18 November 2026 in the local `feat/czech-support` worktree after merging `preview` at `b47df7d9`. The checks below include the working-tree change to Infotabule.

## Coverage

- **Stations.** The station GeoJSON endpoint returned 2,641 Czech rail stations. Regenerating the dataset from GRAPP, CIS and SR70 in a separate directory reproduced the same features, IDs, coordinates and importance values. The web build prerendered all 2,641 station pages and the Czech country directory. [Station import and source limitations](../packages/data/README.md#czech-stations)
- **Operators.** The country filter returns 16 operators. Eleven run domestic or regional trains: České dráhy, Arriva, Leo Express, RegioJet, GW Train Regio, AŽD Praha, Die Länderbahn CZ, KŽC Doprava and Gepard Express, plus DPP for the Prague metro and DPMLJ for the Liberec–Jablonec tram. European Sleeper, ÖBB, DB, PKP Intercity and Koleje Dolnośląskie were extended to Czechia for their cross-border trains. Osoblažská úzkorozchodná dráha (`OÚD`), which took over the Třemešná–Osoblaha line from ČD on 14 December 2025, is still missing because it publishes no vector logo. [OÚD operator page](https://www.osoblazsko.com/oud/)
- **Lines.** Four lines are mapped. Prague metro A, B and C have 58 metro stations (`CZM001`–`CZM058`), one route each, PID colors and weekday and weekend service from the [PID GTFS feed](https://data.pid.cz/PID_GTFS.zip). Tram line 11 between Liberec and Jablonec nad Nisou is the only light line, with 23 stops (`CZL001`–`CZL023`) and no service hours yet. Stops and track come from OpenStreetMap. Flora on line A is included although it is closed for renovation until about December 2026. City tram networks in Prague, Brno, Ostrava and elsewhere stay out of scope, as in other countries. Infotabule service labels such as Ex3, S2 and U10 remain train attributes, not catalog lines. [Line data sources](../packages/data/README.md#czech-stations)

## Live board checks

The local API Worker fetched both directions from Infotabule with the scraper's normal request headers. The table records a point-in-time sample. Counts can change with the timetable.

| Station                       | Departures | Arrivals |
| ----------------------------- | ---------: | -------: |
| Praha hlavní nádraží          |         24 |       24 |
| Pardubice hlavní nádraží      |         30 |       30 |
| Brno hlavní nádraží           |         22 |       22 |
| Ostrava hlavní nádraží        |         18 |       18 |
| Liberec                       |         10 |       10 |
| Louny                         |         10 |        9 |
| Rakovník                      |         18 |       18 |
| Blatec                        |          6 |        6 |
| Blíževedly                    |          4 |        4 |
| Most                          |         10 |       10 |
| Čížkovice                     |         10 |       10 |
| Sedlec u Mikulova             |         10 |       10 |
| Ústí nad Labem hlavní nádraží |         20 |       20 |
| Třebívlice                    |   HTTP 502 | HTTP 502 |

The successful responses included all eight observed carrier codes across the seven directory entries (`ČD`, `ARR`, `LEO`, `RJET`, `RJÚK`, `GWTR`, `AŽD` and `DLB`). For Třebívlice (`CZ5455369`), Infotabule returned its station picker without a train table or an explicit no-board notice. The scraper treated that response as an upstream error. [Třebívlice source response](https://www.spravazeleznic.cz/cestujici/infotabule?station=5455369)

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

### KŽC Doprava

- Asset: [kzc-doprava.svg](../apps/web/public/assets/operators/cz/kzc-doprava.svg).
- Vector from page 1 of KŽC's own [2026 calendar PDF](https://kzc.cz/download/kalendar_2026.pdf); the site header logo is PNG only. Kept the full lockup with its white inner area and omitted the ® mark. Color `#231f20`.
- Operator metadata: [regular public trains](https://kzc.cz/?sekce=pravidelne_verejne_vlaky) and [company information](https://kzc.cz/?sekce=o_nas_kontakty).

### Gepard Express

- Asset: [gepard-express.svg](../apps/web/public/assets/operators/cz/gepard-express.svg).
- The `#G` symbol from the inline SVG in [gepard.com](https://www.gepard.com/)'s own site code; the full wordmark exists only as PNG. Color `#eee300`, which has low contrast on the white tile.
- Operator metadata: [Jindřichův Hradec narrow-gauge contracts](https://zdopravy.cz/podepsano-jindrichohradecke-uzkokolejky-uz-maji-smlouvy-s-kraji-na-letosni-rok-ceny-za-km-se-lisi-279058/). Its Infotabule carrier code is not confirmed, because its season ended on 17 November.

### Dopravní podnik hl. m. Prahy

- Asset: [dpp.svg](../apps/web/public/assets/operators/cz/dpp.svg).
- [DP_logo_horiz_CMYK.svg](https://www.dpp.cz/cs/data/2019/Loga%20DP/Horizont%C3%A1ln%C3%AD%20barevn%C3%A1%20varianta/DP_logo_horiz_CMYK.svg) from the [official logo downloads](https://www.dpp.cz/spolecnost/pro-media/loga-ke-stazeni). Kept the symbol and omitted the wordmark. Red `#d92420`.

### Dopravní podnik měst Liberce a Jablonce nad Nisou

- Asset: [dpmlj.svg](../apps/web/public/assets/operators/cz/dpmlj.svg).
- Vector from DPMLJ's own [network map PDF](https://web.archive.org/web/20240506140718/http://www.dpmlj.cz/images/Obrazky/01DPMLJ/PLANY/2024-01-29%20plan%20site.pdf) (Wayback copy, because dpmlj.cz refused connections). Kept the triangle-arrow symbol and omitted the wordmark. Color `#2b2a29`.

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

- The API passed 1,145 tests across 35 files. The status dashboard passed all 27 tests, including the fallback icon for a provider without artwork.
- Workspace type checks and lint passed. The SVG optimizer reported zero changes for the three new operator logos.
- Web, Studio and the status dashboard built locally. The API production build failed in both the merged worktree and a clean copy of local `preview` at `b47df7d9`. Wrangler 4.163.0 produced `.cloudflare/output/v1/config.json` while `cf build` expected `.cloudflare/output/v0/config.json`. Live API checks used the local development Worker.
