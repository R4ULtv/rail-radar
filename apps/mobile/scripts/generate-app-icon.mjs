// Render the web app's logo for the mobile app icons and splash screen.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const logoUrl = new URL("../../web/public/icon.svg", import.meta.url);
const assetsUrl = new URL("../assets/", import.meta.url);
const logo = await readFile(logoUrl, "utf8");

// The operating system supplies the launcher icon mask. Keep the background
// square so iOS does not show transparent corners inside its rounded mask.
const launcherIcon = logo.replace('rx="128"', 'rx="0"');
await sharp(Buffer.from(launcherIcon))
  .resize(1024, 1024)
  .flatten({ background: "#6363ff" })
  .removeAlpha()
  .png()
  .toFile(fileURLToPath(new URL("icon.png", assetsUrl)));

await sharp(Buffer.from(logo))
  .resize(48, 48)
  .png()
  .toFile(fileURLToPath(new URL("favicon.png", assetsUrl)));

// Android applies its own mask to the foreground and background layers.
const foreground = logo.replace(/  <rect[^>]+\/>\n/, "");
for (const filename of ["adaptive-icon.png", "splash-icon.png"]) {
  await sharp(Buffer.from(foreground))
    .resize(1024, 1024)
    .png()
    .toFile(fileURLToPath(new URL(filename, assetsUrl)));
}
