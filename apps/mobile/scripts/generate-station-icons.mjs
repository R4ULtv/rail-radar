// Renders the web map's station icon SVGs to PNGs for the native map.
// The native SDK can't load SVG, and snapshotting react-native-svg views is racy.
// Run `pnpm --filter=mobile generate:station-icons` after changing the web icons.
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const source = new URL("../../web/src/components/station-markers.tsx", import.meta.url);
const outDir = new URL("../assets/station-icons/", import.meta.url);
const icons = {
  RAIL_ICON_SVG: "rail-icon",
  METRO_ICON_SVG: "metro-icon",
  LIGHT_ICON_SVG: "light-icon",
};
const size = 64;

const code = await readFile(source, "utf8");
await mkdir(outDir, { recursive: true });

for (const [constant, name] of Object.entries(icons)) {
  const svg = code.match(new RegExp(`const ${constant} = \`([\\s\\S]*?)\`;`))?.[1];
  if (!svg) throw new Error(`${constant} not found in ${source.pathname}`);

  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? "" : `@${scale}x`;
    await sharp(Buffer.from(svg), { density: 72 * scale })
      .resize(size * scale, size * scale)
      .png()
      .toFile(new URL(`${name}${suffix}.png`, outDir).pathname);
  }
}
