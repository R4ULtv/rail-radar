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
- **Live position.** The location dot animates between measured positions. Locate starts camera
  following; panning or opening a station stops it. Opening a station leaves the camera in place.
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

### Google Play release

Google Play signs the app with a key it keeps. Uploads are signed with an upload key kept
outside the repository and named in `~/.gradle/gradle.properties`:

```properties
RAILRADAR_UPLOAD_STORE_FILE=/Users/you/.android-keys/railradar-upload.jks
RAILRADAR_UPLOAD_KEY_ALIAS=upload
RAILRADAR_UPLOAD_STORE_PASSWORD=…
RAILRADAR_UPLOAD_KEY_PASSWORD=…
```

`plugins/with-release-signing.js` signs release builds with it, and without it they keep the
debug key, which Google Play rejects. Before each upload, bump the app version and build number
from the repository root:

```sh
pnpm --filter mobile bump-version
```

This increments the patch version and build number. Pass `minor`, `major`, or an explicit version
to choose another version, and optionally pass a build number (for example,
`pnpm --filter mobile bump-version 0.2.0 4`). The script updates `app.json`, `package.json`,
`CHANGELOG.md`, and existing generated Android and iOS project files. Add release notes under
`Unreleased` before running it, or fill in the new release entry afterward.

Pass `--tag` to commit only the three tracked release files and create an annotated tag such as
`mobile-v0.2.0`. Use `--tag-current` to commit and tag a version that was already bumped. Both
options only create local tags; they do not push to GitHub. Existing staged changes must be
committed or unstaged first, so the release commit stays focused.

```sh
pnpm --filter mobile bump-version minor --tag
pnpm --filter mobile bump-version --tag-current
```

Then build the bundle in `android/app/build/outputs/bundle/release/`:

```sh
npx expo prebuild -p android
cd android && ./gradlew app:bundleRelease
```

`app.json` blocks the permissions the app doesn't use: drawing over other apps, which Expo's
template adds for development, and the shared storage ones from `expo-image` and
`expo-file-system`. The app doesn't use an advertising ID, so the Play Console's advertising ID
declaration is "No".

Release builds are shrunk with R8, which removes unused code and resources. The bundle includes
R8's mapping file, so the Play Console's crash reports are readable without uploading
`android/app/build/outputs/mapping/release/mapping.txt` separately. An early R8 build broke the
map's camera, the stations and the search sheet's width, so after changing native dependencies,
check those on a release build.

Android builds include only ARM32 (`armeabi-v7a`) and ARM64 (`arm64-v8a`). The
`expo-build-properties` configuration in `app.json` keeps this setting across prebuilds. This
reduces the uploaded bundle by excluding Intel architectures; Google Play already serves only
the architecture needed by each phone.

To test the bundle on a device or emulator, build an APK from it:

```sh
cd android && ./gradlew app:packageReleaseUniversalApk
adb install -r app/build/outputs/apk_from_bundle/release/app-release-universal.apk
```

### Diagnosing an error screen

The app catches React rendering errors and keeps running, so a "Something went wrong" screen
usually won't produce a crash in Play Console's Android vitals. The error screen's **Report a
problem** button prefills the issue with the exception, JavaScript and React component stacks,
app version/build, Android device model, and display settings. **Share error details** shares the
full report, including stacks too long for the issue URL. Nothing is uploaded automatically.

For an older build without those details, connect the affected phone with USB debugging enabled,
start this command, reproduce the problem, then stop it with Ctrl+C:

```sh
adb logcat -v threadtime ReactNativeJS:E AndroidRuntime:E '*:S' > rail-radar-error.txt
```

Keep `android/app/build/generated/sourcemaps/react/release/index.android.bundle.map` with each
released bundle, before the next build overwrites it. R8's mapping file decodes Java/Kotlin
stacks; Hermes JavaScript stacks need this source map from the **exact same build**. From
`apps/mobile`, decode a captured JavaScript stack with:

```sh
npx metro-symbolicate android/app/build/generated/sourcemaps/react/release/index.android.bundle.map < rail-radar-error.txt
```

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

### Preferences

Settings and one-time UI choices live in `preferences.json` in the app's document directory:
theme, map style, welcome dismissal, nearby-button usage, and the last release notes seen.
`src/lib/preferences.ts` owns validation, defaults, migration, and persistence. Use
`getPreference(key)` outside React, `usePreference(key)` to subscribe to a single value, and
`setPreference(key, value)` to update it. Theme changes go through `setThemePreference` so
Uniwind and the native appearance change too.

The store reads once before rendering and keeps changes in memory even if a disk write fails.
Existing per-preference files migrate automatically and are removed only after a successful
write. Saved/recent stations, location, and station downloads keep their own data files.

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

- Location is foreground-only. A cancellable, short-lived Expo watch obtains one fresh fix every
  5 seconds while moving or uncertain, then every 30 seconds after two fresh, reliable fixes stay
  within the same area (20 metres or the sum of their accuracy radii, whichever is larger).
  Speed estimates do not override matching positions. Movement is measured from a fixed reference
  position so slow walking eventually resumes five-second checks. Fixes with unknown accuracy or
  an accuracy radius over 100 metres cannot confirm stillness. Locate still refreshes immediately.
  Acquisition may take longer when GPS is unavailable; requests never overlap. Mapbox draws an
  animated map layer from these fixes, without running its own location tracker. The dot smooths
  measured movement over 700 ms and does not predict future positions. Actual battery usage needs
  checking on a device.
- Visible search results refresh their distances and ranking at most every 30 seconds after at
  least 50 metres of movement. Opening search, a new query, or the first location fix refreshes
  them immediately. GPS jitter does not continually shuffle the results.
- Run the movement, scheduling, acquisition and cancellation tests with
  `pnpm --filter=mobile test:location`, or directly with
  `node --experimental-strip-types --test apps/mobile/tests/location-tracking.test.mjs` from the root.
- Stations ship with the app from `packages/data/src/stations.geojson`. At most once a day, the
  app downloads the latest `stations.geojson` from the API in the background and uses it from the
  next launch.
- Requests send a `User-Agent` such as `RailRadar/<version> (iOS 18.2)`, with the version from
  `app.json`. Filter on `RailRadar/` in Cloudflare Workers Logs to see the app's requests.
- Mapbox's attribution button is hidden, since telemetry is off. The credits are at the bottom of
  the search and map style sheets and in the settings.
- Map tiles use Mapbox's native disk cache with a seven-day minimum update interval, configured
  by `patches/@rnmapbox__maps@10.3.5.patch` in this app. It covers the Simple map in
  light and dark mode and the railway source added for Streets. Mapbox Standard's imported
  base-map sources are hidden from this API and retain their default caching. Styles, fonts,
  station data and live boards also retain their own refresh policies. This changes tile
  freshness, not the disk budget or a guarantee that tiles remain stored for seven days.
  Existing expired tiles may revalidate once before adopting the longer interval. Changing
  the patch requires rebuilding the native app; Metro reloads and OTA updates cannot apply it.
- The railway lines are pinned below the station layers and mounted after them: on iOS, rnmapbox
  10.3.5 never adds a layer that waits for one that isn't on the map yet
  ([rnmapbox/maps#4288](https://github.com/rnmapbox/maps/pull/4288)).
