# Rail Radar mobile map prototype

A small Expo + native Mapbox test for iOS and Android. It ships the station
GeoJSON from `@repo/data`, draws the web map's station icons and railway
lines at the same zoom levels, opens a live
departures and arrivals bottom sheet for rail stations, and can center the map
on the device's location. The map controls, sheet controls, and notices use
HeroUI Native with Uniwind and Lucide icons; the sheet gesture container uses
Gorhom Bottom Sheet. The sheet links to the existing web station page and
refreshes live data while it is open and the app is active.

This is pinned to Expo SDK 55 and `@rnmapbox/maps` 10.3.5 so it can be compiled
with Xcode 26.3. Expo SDK 56 and 57 require Xcode 26.4 or newer. It uses React
Native's New Architecture.
The mobile workspace uses `@types/react` 19.3 to keep React types consistent
across the monorepo; this types-only package is excluded from Expo's version
check intentionally.

## Layout

```text
index.ts            Expo entry; registers src/app.tsx
src/
  app.tsx           Root providers (gesture handler, safe area, HeroUI)
  global.css        Uniwind + HeroUI theme
  components/       Screens, sheets and map layers
  hooks/            Data and storage hooks
  lib/              API client and shared helpers
assets/station-icons/  Map icons rendered from the web SVGs
scripts/            Asset generators
```

Imports from `src` use the `@/` alias, as in `apps/web`. Files are kebab-case.
`station-markers.tsx` mirrors `apps/web/src/components/station-markers.tsx`;
keep the zoom levels in sync. After changing the web icon SVGs, run
`pnpm --filter=mobile generate:station-icons` to re-render the PNGs.
Country flags import the web's SVGs from `apps/web/public/assets/flags` directly;
`react-native-svg-transformer` compiles them into `react-native-svg` components at
build time. `country-flag.tsx` is typed against `CountryCode`, so a new country fails
the type check until its flag is imported.
After changing `apps/web/public/icon.svg`, run
`pnpm --filter=mobile generate:app-icon` to update the launcher, splash, and favicon art.

## Credentials

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_MAPBOX_TOKEN` to a
**public** Mapbox token (`pk.…`). Check that the token is allowed for native
mobile requests; a token restricted to the website's URL may not work.

The Mapbox SDK artifacts used by this prototype downloaded without a secret
token on both platforms. If an older SDK or a different build environment
returns HTTP 401 while fetching Mapbox artifacts, create a separate **secret**
Mapbox token with the `DOWNLOADS:READ` scope and put it in your own machine's
credential files:

- iOS `~/.netrc`:

  ```text
  machine api.mapbox.com
    login mapbox
    password YOUR_DOWNLOADS_READ_TOKEN
  ```

- Android `~/.gradle/gradle.properties`:

  ```properties
  MAPBOX_DOWNLOADS_TOKEN=YOUR_DOWNLOADS_READ_TOKEN
  ```

Keep the download token out of `.env.local`, `app.json`, and Git. The Mapbox
config plugin reads the local credentials during native builds.

## Run

From the repository root, install dependencies with `pnpm install`, then run:

```sh
pnpm --filter mobile ios
pnpm --filter mobile android
```

For local Android builds, use Java 21 and point `ANDROID_HOME` at your Android
SDK. On the Mac used for this prototype:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
pnpm --filter mobile android
```

The Android command needs a connected device or a configured emulator.

These commands build and install a custom development app. **Expo Go cannot run
Mapbox's native module.** Once a development app is installed, use
`pnpm --filter mobile start` for JavaScript changes. Changes to native
dependencies or app config require rebuilding the development app.

Stations are bundled: `packages/data/src/stations.geojson` ships as an app asset
and the native map reads it from disk, so a launch needs no station request.
30 seconds after launch, at most once a day, the app downloads
`https://api.railradar24.com/stations.geojson` in the background and uses it from
the next launch. The download is tied to the bundled file's hash, so an app
update with newer bundled stations replaces it. The selected rail station's board
is fetched from `/stations/:id` every 30 seconds while the sheet is open and the
app is active.

Offline, the map, search and nearby stations keep working from the bundled data and
Mapbox's cache. Requests time out after 15 seconds. `expo-network` tells the app when
it's offline, so the live board can say so, and the board, station stats, photos,
trending list and a map that failed to load are loaded again once the connection is back.
A crash shows a "Something went wrong" screen, or a message in the station sheet if only
the station failed, instead of closing the app.

Requests from the app send a `User-Agent` such as `RailRadar/0.1.0 (iOS 18.2)` or
`RailRadar/0.1.0 (Android 15)`, with the version from `app.json`. This covers the API,
the background station download, and the web's station photos. The photos load through
`expo-image`, which keeps them in its memory and disk caches. Operator logos are
bundled from `apps/web/public/assets/operators` by `pnpm --filter=mobile generate:brand-logos`.
In Cloudflare Workers Logs, filter on a user agent starting with `RailRadar/` to see
requests from the app. It identifies the app for logging; it is not an
authentication mechanism.

The search sheet stays open at the bottom of the map, showing only the search bar
until it is dragged up or focused. It searches the same station GeoJSON on the device, from
the first character, so it works offline. Saved stations come first, then recent ones, if a word
in their name starts with the query. After how well the name matches, results are ordered by
distance band (under 10 km, 100 km, 300 km, then farther), then rail before metro and light
rail, then importance, then distance. Focusing the field builds the index.
A search only visits the stations whose names contain the query's longest word, found with
`indexOf` in one string of every name, and results render in the background with
`useDeferredValue`. Until the first results, it shows a skeleton like the web's. When the query
is empty, it lists recent rail stations (up to 10, the first 3 shown) and saved stations (the
first 5 shown), each with a "Show all" button for the rest. Both lists are stored as JSON files
in the app's document directory through `expo-file-system`.
Below them it shows the 7-day trending stations from `/stations/trending?period=week`,
with unique visitors and visits. They load on launch and refresh every 5 minutes, but only
while the search sheet is open and the app is active.

On the first launch, a welcome page sheet thanks the user for buying the app and lists what it
does. Closing it, with "Get started" or by swiping it down, saves `welcome.json` so it isn't shown
again. The location permission prompt waits until it's closed, so the prompt doesn't cover it.

As in Apple Maps, the locate button and the compass sit just above the open sheet and follow
it, fading out once it's opened past its smallest size. The gear in the top-right corner opens
settings: a page sheet on iOS, with a handle like the bottom sheets, and a full-screen page on
Android. It has the appearance (system, light or dark, saved to `theme.json` and applied before
the first render), location access, which opens the system settings, and links for support, the
website, the legal pages and the source code. Its "On this device" section clears the recent
and saved stations, forgets the last location (`user-location.json`), resets the stations to
the bundled copy by deleting the download (the map switches right away, and the next launch
downloads them again), and clears the Mapbox tile cache and `expo-image`'s photo caches.

The user's location never leaves the device: it's only used to show them on the map and sort
stations by distance, and the last one is kept for a day so the map opens there. Mapbox's
telemetry, which would send location events to Mapbox, is turned off with
`Mapbox.setTelemetryEnabled(false)`. That's also the opt-out Mapbox's terms require, which its
attribution button would offer; the button is hidden, and the attribution is at the bottom of the
search sheet and in the settings' Map section, with Mapbox's privacy policy and the telemetry
shown as off. "Improve this map" opens Mapbox's feedback where the map is, which the map screen
keeps in a ref from `onCameraChanged`.
