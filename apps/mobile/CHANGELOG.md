# Changelog

All notable changes to the Rail Radar mobile app. Versions match `version` in `app.json`, and the
build number in parentheses matches `android.versionCode`. When known, release entries also note
the commit they were built from.

## [Unreleased]

## [0.2.0] (4) – 2026-09-29

### Added

- The map is blurred under the status bar, like Apple Maps, so the clock and icons stay legible.
  Android gets a plain scrim.
- Loading skeletons for the station sections that load late.

### Changed

- Faster: the React Compiler is on, the board, map and search re-render less, the stations are
  bundled minified and preloaded while the map is idle, the search index is built in short
  batches, and station details wait until the map settles. The Android release build is shrunk
  with R8.
- Error and empty states are centered, with an icon and a centered Try again button. A station
  that fails to show keeps its name in the sheet header.
- Stale live trains are marked with a notice like the station info above them; online, tapping it
  loads the trains again.
- Delays of an hour or more are shown in hours.
- Visual polish: shadows on the map sheets, fading sheet headers, a divider between the grouped
  map buttons, list separators inset to the row titles, train rows separated like the other
  lists, a visible popularity bar track and a muted dash for unknown platforms.
- Settings match the other sheets: icons sized like the station icons, destructive rows in red,
  external rows marked with ↗, and the Mapbox telemetry note as a footer.
- Trending shows one visitor count per station.
- The app no longer says it's free, only open source.

### Fixed

- Offline, switching between departures and arrivals no longer loses the trains already received.
- Selected stations stay clear of the station sheet, above the map's center.
- Train status strips no longer touch the sheet's edge.
- Recent stations are saved without blocking the app.

## [0.1.2] (3) – 2026-09-28

Built from `a6bbaca`.

### Added

- A release command that updates the app version, Android and iOS build numbers, and changelog
  together.

### Changed

- Search and station sheets open to fit their content. The map stays interactive until a sheet
  reaches the top of the screen, and the settings button fades as a sheet approaches it.
- Map control icons are smaller, and the controls fade away when the map style sheet opens.
- Sheet headers and spacing are consistent, with clearer search errors and empty states.
- The first-launch welcome thanks beta testers and highlights what the app adds to the website.

## [0.1.1] (2) – 2026-09-27

Built from `c10602e`.

### Added

- Station links shared from the website open straight into the app, on the station's sheet.

### Changed

- Prepared for Google Play: release builds are signed with the upload key, and unused Android
  permissions are removed.

## [0.1.0] (1) – 2026-09-26

Built from `f90d2b2`. First build.

### Added

- Map of 22,000+ stations across 14 countries, with the railway lines, in light and dark.
- Station sheet with live departures and arrivals, operator logos, photos, visit stats,
  expandable notices and a Share button.
- On-device station search that works offline, ranks saved and recent stations first and shows
  the distance to each result.
- Unlimited saved stations and the last 10 opened stations.
- Trending stations of the week.
- Simple or street map, and a native location puck with a locate button and compass.
- Settings with map style, local data controls, privacy info and map credits.
- Welcome sheet on first launch.
- Offline, request error and crash handling.
