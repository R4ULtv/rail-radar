# Rail Radar for iOS and Android

> **Coming soon.** The app isn't public yet, and won't be before **October 10, 2026**. Google
> Play has to run it as a closed test for 14 days before it can be published. Until then, Rail
> Radar is free on the web at [railradar24.com](https://www.railradar24.com).

Rail Radar's European railway map as a native app: every station on the map, its live
departures and arrivals a tap away, and a search that works even without a connection. It's a
paid app. Buying it supports the project and keeps the website free for everyone.

## Features

- **Live departures and arrivals.** Tap a station to see its trains with their operators' logos,
  updated every 30 seconds, wherever the official sources provide them.
- **22,000+ stations across 14 countries**, the same coverage as the website, with the railway
  lines drawn on the map.
- **Instant search, even offline.** Every station is stored on the phone, and results appear from
  the first letter, with saved and recent stations first and nearby stations before distant ones.
- **Your stations, one tap away.** Save any number of stations and find the last 10 you opened
  in the search.
- **Trending stations** of the week, ranked by unique visitors.
- **Station details** with photos and visit stats, and a Share button that sends a link to the
  station's page on the website.
- **Two maps, light and dark.** A simple map that keeps the railway in front, or Mapbox's street
  map, following the system appearance or set in the settings.
- **Works offline.** The map, search and nearby stations keep working from the stations bundled
  with the app and Mapbox's cache, and live data comes back as soon as the connection does.
- **Private by design.** No account. The location is only used on the device to show you on the
  map and sort stations by distance, and Mapbox's telemetry is turned off.

## Development

The app is built with Expo SDK 55 and React Native 0.83 (New Architecture), with
`@rnmapbox/maps` 10.3.5 for the map, HeroUI Native with Uniwind for the UI, and Gorhom Bottom
Sheet for the sheets. It's pinned to Expo SDK 55 so it builds with Xcode 26.3; SDK 56 and 57
need Xcode 26.4 or newer.

### Setup

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_MAPBOX_TOKEN` to a **public** Mapbox
token (`pk.…`) that is allowed for native mobile requests.

The Mapbox SDK downloads without a secret token. If a build returns HTTP 401 while fetching
Mapbox artifacts, create a secret token with the `DOWNLOADS:READ` scope and put it in
`~/.netrc` for iOS and in `~/.gradle/gradle.properties` as `MAPBOX_DOWNLOADS_TOKEN` for
Android, never in the repository.

### Run

From the repository root, run `pnpm install`, then:

```sh
pnpm --filter mobile ios
pnpm --filter mobile android
```

Android builds need JDK 17 and `ANDROID_HOME` set to the Android SDK:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

These commands build a development app; Expo Go can't run Mapbox's native module. Once it's
installed, `pnpm --filter mobile start` serves JavaScript changes. Native dependency or app config
changes need a new build.

### Layout

```text
index.ts               Expo entry; registers src/app.tsx
src/
  app.tsx              Root providers (gesture handler, safe area, HeroUI)
  global.css           Uniwind + HeroUI theme
  components/          Screens, sheets and map layers
  hooks/               Data and storage hooks
  lib/                 API client and shared helpers
assets/station-icons/  Map icons rendered from the web SVGs
assets/map-styles/     Map style previews
scripts/               Asset generators
```

Imports from `src` use the `@/` alias, and files are kebab-case, as in `apps/web`.

### Keeping it in sync with the web

- `station-markers.tsx` mirrors `apps/web/src/components/station-markers.tsx`; keep the zoom
  levels the same.
- After changing the web's station icon SVGs, run `pnpm --filter=mobile generate:station-icons`.
- After changing `apps/web/public/icon.svg`, run `pnpm --filter=mobile generate:app-icon`.
- After adding operator logos, run `pnpm --filter=mobile generate:brand-logos`.
- Country flags import the web's SVGs directly, and a new country fails the type check until its
  flag is imported in `country-flag.tsx`.
- The previews in `assets/map-styles` are Milano Centrale at zoom 14 in each style and theme,
  captured on an iPhone simulator: a 660 × 495 px crop of the screen's center, resized to
  520 × 390 px JPEGs. Capture them again after changing how the map looks.

### Notes

- Stations ship with the app from `packages/data/src/stations.geojson`. At most once a day, the
  app downloads the latest `stations.geojson` from the API in the background and uses it from the
  next launch.
- Requests send a `User-Agent` such as `RailRadar/0.1.0 (iOS 18.2)`, with the version from
  `app.json`. Filter on `RailRadar/` in Cloudflare Workers Logs to see the app's requests.
- Mapbox's attribution button is hidden, since telemetry is off. The credits are at the bottom of
  the search and map style sheets and in the settings.
- The railway lines are pinned below the station layers and mounted after them: on iOS, rnmapbox
  10.3.5 never adds a layer that waits for one that isn't on the map yet
  ([rnmapbox/maps#4288](https://github.com/rnmapbox/maps/pull/4288)).
