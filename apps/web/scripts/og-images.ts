import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { getCountry } from "../../../packages/data/src/countries.ts";
import type { Station, StationFeatureCollection } from "../../../packages/data/src/types.ts";
import {
  OG_INVENTORY_KEY,
  ogImageKey,
  parseStationOgInventory,
  stationIdFromOgKey,
} from "../src/lib/station-og.ts";
import type { StationOgInventory } from "../src/lib/station-og.ts";
import { sha256, stationInputHash, isLocalOgImage } from "./og-inventory.ts";
import type { ListedOgObject, LocalOgImage } from "./og-inventory.ts";
import { MAP_REVISION, renderStationOg, stationMapPath } from "./og-render.tsx";

const web = fileURLToPath(new URL("../", import.meta.url));
const cacheDirectory = join(web, ".og-cache");
const exec = promisify(execFile);
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    level: { type: "string" },
    id: { type: "string", multiple: true },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    bucket: { type: "string", default: "rail-radar" },
    jurisdiction: { type: "string", default: "eu" },
    concurrency: { type: "string", default: "3" },
    help: { type: "boolean", short: "h" },
  },
});
const [command = "status"] = positionals;
const usage = `Usage: pnpm --filter web og <status|sync|generate|upload> [options]
  --level 1              Only one station importance (default: every rail station)
  --id IT1728            Select station ID(s), independent of importance; repeat or comma-separate
  --force                Refresh selected images and their maps, even if inputs match
  --dry-run              Show the plan without generating images or changing R2
  --concurrency 3        Maximum concurrent jobs (default: 3, maximum: 8)
  --bucket rail-radar    R2 bucket (default: rail-radar, EU jurisdiction)

status   Compare current inputs with R2; write .og-cache/inventory.json and inventory.csv
sync     Generate and replace only missing/outdated station images
generate Generate selected images locally; unchanged local files are reused
upload   Upload matching local images and publish them; never calls Mapbox or renders`;

if (values.help) {
  console.log(usage);
  process.exit(0);
}
if (!["status", "sync", "generate", "upload"].includes(command) || positionals.length > 1) {
  throw new Error(usage);
}
if (values.level !== undefined && !["1", "2", "3", "4"].includes(values.level))
  throw new Error("--level must be 1, 2, 3 or 4");
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
  throw new Error("--concurrency must be 1–8");
if (values.force && command === "upload")
  throw new Error("Use sync --force to refresh images, or upload without --force");
if (values.level !== undefined && values.id?.length) throw new Error("Choose --level or --id");
// --force re-downloads every selected map; never let it default to the whole catalog.
if (values.force && values.level === undefined && !values.id?.length)
  throw new Error("--force refetches maps from Mapbox; narrow it with --id or --level");
if (existsSync(join(web, ".env"))) loadEnvFile(join(web, ".env"));

const catalog = JSON.parse(
  readFileSync(join(web, "../../packages/data/src/stations.geojson"), "utf8"),
) as StationFeatureCollection;
const stations: (Station & { geo: { lat: number; lng: number } })[] = catalog.features.map(
  ({ properties, geometry }) => ({
    ...properties,
    geo: { lat: geometry.coordinates[1]!, lng: geometry.coordinates[0]! },
  }),
);
const ids = new Set(values.id?.flatMap((id) => id.split(",")) ?? []);
for (const id of ids) {
  const station = stations.find((station) => station.id === id);
  if (!station) throw new Error(`Unknown station: ${id}`);
  // Only rail stations have pages that reference /media/og (see getRailStation).
  if (station.type !== "rail")
    throw new Error(`${id} is a ${station.type} station; OG images are rail-only`);
}
const selected = stations.filter(
  (station) =>
    station.type === "rail" &&
    (ids.size
      ? ids.has(station.id)
      : values.level === undefined || station.importance === Number(values.level)),
);
if (!selected.length) throw new Error("No stations selected");
const takumiPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.resolve("takumi-js")), "utf8"),
);
const rendererHash = sha256(
  Buffer.concat([
    ...[
      "scripts/og-render.tsx",
      "src/lib/station-marker-icons.ts",
      "src/assets/fonts/Geist/Geist[wght].woff2",
      "src/assets/fonts/Geist/GeistMono.woff2",
    ].map((path) => readFileSync(join(web, path))),
    Buffer.from(String(takumiPackage.version)),
  ]),
);
const countryResources = new Map<string | null, string>();
const hashes = new Map(
  stations.map((station) => {
    const country = getCountry(station.id);
    let resources = countryResources.get(country);
    if (!resources) {
      const flag = country
        ? readFileSync(join(web, `public/assets/flags/${country}.svg`))
        : Buffer.alloc(0);
      resources = sha256(
        Buffer.concat([
          Buffer.from(rendererHash),
          flag,
          Buffer.from(getCountry(station.id, { format: "name" }) ?? ""),
        ]),
      );
      countryResources.set(country, resources);
    }
    return [station.id, stationInputHash(station, resources)] as const;
  }),
);

async function atomicJson(path: string, value: unknown, pretty = true) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, pretty ? 2 : undefined) + "\n");
  await rename(temporary, path);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

const r2Args = ["--bucket-name", values.bucket!, "--cf-r2-jurisdiction", values.jurisdiction!];
async function cf(args: string[]): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await exec("cf", args, { cwd: web, maxBuffer: 32 * 1024 * 1024 })).stdout;
    } catch (error) {
      const message = (error as { stderr?: string }).stderr ?? String(error);
      if (attempt < 3 && /429|rate.?limit|50[0234]|timed?\s*out|ECONNRESET/i.test(message)) {
        await delay(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`cf ${args.slice(0, 3).join(" ")} failed: ${message.trim()}`);
    }
  }
}

async function listRemote(): Promise<ListedOgObject[]> {
  const result: ListedOgObject[] = [];
  let after = "";
  for (;;) {
    const page: ListedOgObject[] = JSON.parse(
      await cf([
        "r2",
        "objects",
        "list",
        ...r2Args,
        "--prefix",
        "og/",
        "--per-page",
        "1000",
        ...(after ? ["--start-after", after] : []),
      ]),
    );
    if (!Array.isArray(page)) throw new Error("Unexpected R2 listing response");
    if (!page.length) return result;
    result.push(...page);
    const next = page
      .map((object) => object.key)
      .sort()
      .at(-1)!;
    if (!next || next <= after) throw new Error("R2 listing did not advance");
    after = next;
  }
}

async function readRemoteObject(key: string): Promise<Uint8Array> {
  // cf beta.18 drops the jurisdiction header on raw object downloads. Keep cf
  // for listings/uploads and use the installed Wrangler only for this EU read.
  const wrangler = join(web, "node_modules/wrangler/bin/wrangler.js");
  const { stdout } = await exec(
    process.execPath,
    [
      wrangler,
      "r2",
      "object",
      "get",
      `${values.bucket}/${key}`,
      "--remote",
      "--jurisdiction",
      values.jurisdiction!,
      "--pipe",
    ],
    { cwd: web, maxBuffer: 32 * 1024 * 1024, encoding: "buffer" },
  );
  return stdout;
}

async function uploadFile(key: string, path: string, contentType: string) {
  const data = await readFile(path);
  const expected = createHash("md5").update(data).digest("hex");
  const result = JSON.parse(
    await cf([
      "r2",
      "objects",
      "put",
      key,
      ...r2Args,
      "--file",
      path,
      "--content-type",
      contentType,
    ]),
  );
  if (result.etag?.replaceAll('"', "") !== expected)
    throw new Error(`R2 upload checksum mismatch: ${key}`);
}

async function mapBytes(
  station: Station & { geo: { lat: number; lng: number } },
): Promise<Uint8Array> {
  const path = stationMapPath(station.geo);
  const localPath = join(cacheDirectory, "maps", `${sha256(path + MAP_REVISION)}.image`);
  if (!values.force) {
    try {
      return await readFile(localPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const token = process.env.MAPBOX_SERVER_TOKEN;
  if (!token) throw new Error("Set MAPBOX_SERVER_TOKEN in apps/web/.env before generating images");
  const url = new URL(`https://api.mapbox.com/styles/v1/${path}`);
  url.searchParams.set("attribution", "false");
  url.searchParams.set("logo", "false");
  url.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error(`Map request failed for ${station.id}; no image was published`);
  }
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/"))
    throw new Error(
      `Map request failed for ${station.id} (HTTP ${response.status}); no image was published`,
    );
  const data = new Uint8Array(await response.arrayBuffer());
  if (!data.length || data.length > 10 * 1024 * 1024)
    throw new Error(`Invalid map size for ${station.id}`);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, data);
  return data;
}

async function main() {
  const remote = command === "generate" ? [] : await listRemote();
  const objects = new Map(remote.map((object) => [object.key, object]));
  const inventory: StationOgInventory = objects.has(OG_INVENTORY_KEY)
    ? parseStationOgInventory(
        JSON.parse(Buffer.from(await readRemoteObject(OG_INVENTORY_KEY)).toString("utf8")),
      )
    : {};
  const plan = selected.map((station) => {
    const version = hashes.get(station.id)!;
    const object = objects.get(ogImageKey(station.id));
    const status = !object ? "missing" : inventory[station.id] === version ? "current" : "outdated";
    return { station, version, object, status };
  });
  const rows = plan.map(({ station, version, object, status }) => ({
    id: station.id,
    name: station.name,
    importance: station.importance,
    status,
    version,
    bytes: object?.size ?? 0,
    key: ogImageKey(station.id),
  }));
  const summary = {
    selected: selected.length,
    presentInR2: remote.filter((object) => stationIdFromOgKey(object.key) !== null).length,
    current: plan.filter((item) => item.status === "current").length,
    missing: plan.filter((item) => item.status === "missing").length,
    outdated: plan.filter((item) => item.status === "outdated").length,
  };
  if (command !== "generate") console.log(JSON.stringify(summary));
  if (command === "status" || values["dry-run"]) {
    // Recap per importance level; the per-station report lives in inventory.csv/status.json.
    const recap = new Map<number, Record<string, number>>();
    for (const { importance, status } of rows) {
      const counts = recap.get(importance) ?? { current: 0, missing: 0, outdated: 0, total: 0 };
      counts[status]!++;
      counts.total!++;
      recap.set(importance, counts);
    }
    console.table(
      Object.fromEntries(
        [...recap].sort(([a], [b]) => a - b).map(([level, counts]) => [`level ${level}`, counts]),
      ),
    );
  }
  if (command === "status") {
    await atomicJson(join(cacheDirectory, "inventory.json"), inventory, false);
    await atomicJson(
      join(cacheDirectory, "status.json"),
      { ...summary, checkedAt: new Date().toISOString(), stations: rows },
      false,
    );
    const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    await writeFile(
      join(cacheDirectory, "inventory.csv"),
      [
        "id,name,importance,status,version,bytes,key",
        ...rows.map((row) => Object.values(row).map(quote).join(",")),
      ].join("\n") + "\n",
    );
    console.log("Inventory: apps/web/.og-cache/inventory.json; readable report: inventory.csv");
    return;
  }
  if (values["dry-run"]) return;
  let generated = 0,
    uploaded = 0,
    updated = 0;
  const failures: string[] = [];
  const pending = [...plan];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const item = pending.shift();
        if (!item) return;
        const { station, version, object, status } = item;
        // Upload must compare local bytes: a forced map refresh can keep the same input hash.
        if (command === "sync" && status === "current" && !values.force) continue;
        try {
          const path = join(cacheDirectory, "images", `${station.id}.webp`);
          const metadataPath = join(cacheDirectory, "images", `${station.id}.json`);
          const metadata = await readJson<unknown>(metadataPath, null);
          let data: Uint8Array | undefined;
          if (!values.force && isLocalOgImage(metadata) && metadata.version === version) {
            try {
              const cached = await readFile(path);
              if (sha256(cached) === metadata.checksum) data = cached;
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            }
          }
          if (!data) {
            if (command === "upload")
              throw new Error("No matching local image; run generate or sync first");
            data = await renderStationOg(station, await mapBytes(station));
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, data);
            const local: LocalOgImage = { version, checksum: sha256(data) };
            await atomicJson(metadataPath, local, false);
            generated++;
            console.log(`Generated ${station.id} ${station.name} (${data.length} bytes)`);
          }
          if (command !== "generate") {
            const md5 = createHash("md5").update(data).digest("hex");
            // If an upload finished before an interrupted inventory write, resume without reuploading.
            if (object?.etag?.replaceAll('"', "") !== md5) {
              await uploadFile(ogImageKey(station.id), path, "image/webp");
              uploaded++;
              console.log(`Uploaded ${station.id}`);
            }
            if (inventory[station.id] !== version) {
              inventory[station.id] = version;
              updated++;
            }
          }
        } catch (error) {
          const message = `${station.id}: ${error instanceof Error ? error.message : String(error)}`;
          failures.push(message);
          console.error(message);
        }
      }
    }),
  );
  if (command !== "generate" && updated > 0) {
    const path = join(cacheDirectory, "published.json");
    await atomicJson(
      path,
      Object.fromEntries(Object.entries(inventory).sort(([a], [b]) => a.localeCompare(b))),
      false,
    );
    await uploadFile(OG_INVENTORY_KEY, path, "application/json");
  }
  console.log(
    JSON.stringify({
      selected: selected.length,
      generated,
      uploaded,
      updated,
      failed: failures.length,
    }),
  );
  if (failures.length)
    throw new Error(`${failures.length} station(s) failed; rerun the same command to resume`);
}

await mkdir(cacheDirectory, { recursive: true });
const lockPath = join(cacheDirectory, "sync.lock");
let lock;
try {
  lock = await open(lockPath, "wx");
} catch {
  throw new Error(
    `Another OG command is running, or a previous run stopped unexpectedly. Check ${lockPath} before removing the lock.`,
  );
}
await lock.writeFile(String(process.pid));
try {
  await main();
} finally {
  await lock.close();
  await unlink(lockPath);
}
