const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const { writeLineAssets } = require("./scripts/line-assets.cjs");

// The app bundles the stations minified, 40% smaller. The shared file stays readable for
// Studio and reviews, so the copy is made here, whenever Metro starts, and isn't committed.
const stationsSource = require.resolve("@repo/data/stations.geojson");
const stationsAsset = path.join(__dirname, "assets/generated/stations.geojson");
const minifiedStations = JSON.stringify(JSON.parse(fs.readFileSync(stationsSource, "utf8")));
if (!fs.existsSync(stationsAsset) || fs.readFileSync(stationsAsset, "utf8") !== minifiedStations) {
  fs.mkdirSync(path.dirname(stationsAsset), { recursive: true });
  fs.writeFileSync(stationsAsset, minifiedStations);
}
// The metro and light rail tracks, and the names of their operators.
writeLineAssets(path.join(__dirname, "assets/generated"));

const config = getDefaultConfig(__dirname);
// The station and line GeoJSON ship as files for the native map, not as a JS module.
config.resolver.assetExts.push("geojson");
// SVGs compile to react-native-svg components at build time.
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer/expo");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts.push("svg");

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./uniwind-types.d.ts",
});
