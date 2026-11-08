import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { PHOTO_INVENTORY_KEY, parseStationPhotoInventory } from "../src/lib/station-photos.ts";
import type { StationPhotoInventory } from "../src/lib/station-photos.ts";
import type { StationFeatureCollection } from "../../../packages/data/src/types.ts";

const web = fileURLToPath(new URL("../", import.meta.url));
const snapshot = join(web, "src/data/station-photos.json");
const exec = promisify(execFile);
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    bucket: { type: "string", default: "rail-radar" },
    jurisdiction: { type: "string", default: "eu" },
    account: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});
const [command = "check"] = positionals;
const usage = `Usage: pnpm --filter web photos <check|sync|upload> [options]

check   Validate the checked-in catalog; runs before every build without accessing R2
sync    Download stations/inventory.json from R2 into the checked-in snapshot
upload  Publish the checked-in catalog to R2, then verify its checksum

  --account ID       Cloudflare account ID, if cf has access to multiple accounts
  --bucket NAME      R2 bucket (default: rail-radar)
  --jurisdiction EU  R2 jurisdiction (default: eu)

Upload image objects before publishing their catalog entries. Existing per-station
R2 manifests are never changed or deleted. Commit the snapshot and rebuild/deploy
to publish gallery metadata changes to the website.`;

if (values.help) {
  console.log(usage);
  process.exit(0);
}
if (!["check", "sync", "upload"].includes(command) || positionals.length > 1) {
  throw new Error(usage);
}

const stations = JSON.parse(
  await readFile(join(web, "../../packages/data/src/stations.geojson"), "utf8"),
) as StationFeatureCollection;
const railIds = new Set(
  stations.features
    .filter(({ properties }) => properties.type === "rail")
    .map(({ properties }) => properties.id),
);

function validate(value: unknown): StationPhotoInventory {
  const inventory = parseStationPhotoInventory(value);
  if (!Object.keys(inventory).length) throw new Error("Refusing an empty station photo inventory");
  for (const id of Object.keys(inventory)) {
    if (!railIds.has(id)) throw new Error(`Unknown rail station in photo inventory: ${id}`);
  }
  return inventory;
}

async function cf(args: string[]): Promise<Buffer> {
  const { stdout } = await exec(
    process.execPath,
    [join(web, "node_modules/cf/bin/cf"), "r2", "objects", ...args],
    {
      cwd: web,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
      env: values.account ? { ...process.env, CLOUDFLARE_ACCOUNT_ID: values.account } : process.env,
    },
  );
  return stdout;
}

const objectPath = PHOTO_INVENTORY_KEY;
const remoteArgs = ["--bucket-name", values.bucket!, "--cf-r2-jurisdiction", values.jurisdiction!];
const download = () => cf(["get", objectPath, ...remoteArgs]);

const input = command === "sync" ? await download() : await readFile(snapshot);
const inventory = validate(JSON.parse(input.toString("utf8")));
const json = JSON.stringify(inventory, null, 2) + "\n";

if (command === "sync") {
  const temporary = `${snapshot}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, json);
    await rename(temporary, snapshot);
  } finally {
    await rm(temporary, { force: true });
  }
} else if (command === "upload") {
  // Publish the validated bytes, even if the source file changes during the upload.
  const temporary = await mkdtemp(join(tmpdir(), "rail-radar-photo-inventory-"));
  try {
    const file = join(temporary, "inventory.json");
    await writeFile(file, json);
    await cf([
      "put",
      objectPath,
      ...remoteArgs,
      "--file",
      file,
      "--content-type",
      "application/json",
    ]);
    const remote = await download();
    const checksum = (bytes: string | Uint8Array) =>
      createHash("sha256").update(bytes).digest("hex");
    if (checksum(remote) !== checksum(json))
      throw new Error("Photo inventory upload checksum mismatch");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const stationCount = Object.keys(inventory).length;
const photoCount = Object.values(inventory).reduce((count, photos) => count + photos.length, 0);
console.log(
  `${command}: ${stationCount} stations, ${photoCount} photos; ${Buffer.byteLength(json)} bytes`,
);
