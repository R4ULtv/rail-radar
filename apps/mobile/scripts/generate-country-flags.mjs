// Static country flags do not need an SVG view tree in every native list row.
// Keep the web SVGs as the source; Metro generates circular images at each density.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { COUNTRY_CODES } from "@repo/data/countries";

const output = new URL("../assets/generated/flags/", import.meta.url);
const size = 24;
await mkdir(output, { recursive: true });

for (const country of COUNTRY_CODES) {
  const source = new URL(`../../web/public/assets/flags/${country}.svg`, import.meta.url);
  for (const scale of [1, 2, 3]) {
    const pixels = size * scale;
    const mask = Buffer.from(
      `<svg width="${pixels}" height="${pixels}"><circle cx="${pixels / 2}" cy="${pixels / 2}" r="${pixels / 2}" fill="white"/></svg>`,
    );
    const suffix = scale === 1 ? "" : `@${scale}x`;
    const image = await sharp(source.pathname, { density: 72 * scale })
      .resize(pixels, pixels)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const target = new URL(`${country}${suffix}.png`, output);
    const existing = await readFile(target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing?.equals(image)) continue;
    // iOS and Android may start Metro together; never expose a partly written asset.
    const temporary = new URL(`${country}${suffix}.${process.pid}.tmp`, output);
    await writeFile(temporary, image);
    await rename(temporary, target);
  }
}
