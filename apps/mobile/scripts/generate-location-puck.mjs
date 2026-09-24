// Renders the web map's user location marker (apps/web/src/components/map-controls.tsx)
// to PNGs for the native location puck, which the map draws itself so it can't lag
// behind the camera. Run `pnpm --filter=mobile generate:location-puck` after changing it.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const outDir = new URL("../assets/location-puck/", import.meta.url);
// The accent color, the same in both themes (see src/global.css).
const accent = "#6363ff";

const images = {
  // size-4 dot with a 2px white border and a soft shadow; the canvas leaves room for the shadow.
  "location-dot": {
    size: 24,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.25" />
      </filter></defs>
      <circle cx="12" cy="12" r="7" fill="${accent}" stroke="#fff" stroke-width="2" filter="url(#shadow)" />
    </svg>`,
  },
  // size-8 halo at 20% accent.
  "location-halo": {
    size: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="${accent}" fill-opacity="0.2" />
    </svg>`,
  },
  // Stands in for the bearing arrow, which the web marker doesn't have.
  "location-empty": {
    size: 1,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1" />`,
  },
};

await mkdir(outDir, { recursive: true });

for (const [name, { size, svg }] of Object.entries(images)) {
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? "" : `@${scale}x`;
    await sharp(Buffer.from(svg), { density: 72 * scale })
      .resize(size * scale, size * scale)
      .png()
      .toFile(new URL(`${name}${suffix}.png`, outDir).pathname);
  }
}
