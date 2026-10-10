import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { validateLineGeometry, validateLines } from "@repo/data/lines";
import type { Line, LineGeometry } from "@repo/data";

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: Connect.IncomingMessage): Promise<{
  line?: unknown;
  original?: unknown;
  geometry?: unknown;
  originalGeometry?: unknown;
}> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid payload");
  return body;
}

async function atomicWrite(file: string, text: string) {
  const temporaryPath = `${file}.studio-tmp`;
  try {
    await fs.writeFile(temporaryPath, text, "utf8");
    await fs.rename(temporaryPath, file);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

/** Local-only file editing, with atomic writes and conflict detection for competing edits. */
export function localLineApi(options?: {
  linesPath?: string;
  geometryDirectory?: string;
  stationsPath?: string;
}): Plugin {
  const linesPath =
    options?.linesPath ?? path.resolve(process.cwd(), "../../packages/data/src/lines.json");
  const geometryDirectory =
    options?.geometryDirectory ?? path.resolve(process.cwd(), "../../packages/data/src/lines");
  const stationsPath =
    options?.stationsPath ??
    path.resolve(process.cwd(), "../../packages/data/src/stations.geojson");
  const geometryPath = (id: string) => path.join(geometryDirectory, `${id}.json`);
  async function readGeometry(id: string): Promise<LineGeometry | null> {
    try {
      return JSON.parse(await fs.readFile(geometryPath(id), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  let pending = Promise.resolve();
  return {
    name: "studio-local-line-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/lines" && url !== "/api/line-geometry" && !url?.startsWith("/api/lines/"))
          return next();
        async function handle() {
          try {
            const lines: Line[] = JSON.parse(await fs.readFile(linesPath, "utf8"));
            if (url === "/api/lines" && req.method === "GET") return send(res, 200, lines);
            if (url === "/api/line-geometry" && req.method === "GET") {
              const geometries: Record<string, LineGeometry | null> = {};
              for (const line of lines) geometries[line.id] = await readGeometry(line.id);
              return send(res, 200, geometries);
            }
            const match = url?.match(/^\/api\/lines\/([^/]+)$/);
            if (!match || (req.method !== "PUT" && req.method !== "DELETE")) {
              return send(res, 405, { error: "Unsupported line operation" });
            }
            const id = decodeURIComponent(match[1]!);
            const body = await readBody(req);
            const current = lines.find((line) => line.id === id) ?? null;
            const currentGeometry = current ? await readGeometry(current.id) : null;
            if (
              !isDeepStrictEqual(current, body.original) ||
              (req.method === "PUT" &&
                !isDeepStrictEqual(currentGeometry, body.originalGeometry ?? null))
            ) {
              return send(res, 409, {
                error: "This line changed on disk. Reload the lines before saving again.",
              });
            }
            let updated = lines.filter((line) => line.id !== id);
            let saved: { line: Line; geometry: LineGeometry } | null = null;
            if (req.method === "PUT") {
              const stations = JSON.parse(await fs.readFile(stationsPath, "utf8"));
              const stationIds = new Set<string>(
                stations.features.map(
                  (feature: { properties: { id: string } }) => feature.properties.id,
                ),
              );
              updated = validateLines([...updated, body.line], stationIds);
              const line = updated.at(-1)!;
              saved = { line, geometry: validateLineGeometry(body.geometry, line.id) };
            } else if (!current) {
              return send(res, 404, { error: "Line not found" });
            }
            updated.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
            // Track first, so lines.json never lists a line whose file is missing.
            if (saved) {
              await fs.mkdir(geometryDirectory, { recursive: true });
              await atomicWrite(geometryPath(saved.line.id), `${JSON.stringify(saved.geometry)}\n`);
            }
            await atomicWrite(linesPath, `${JSON.stringify(updated, null, 2)}\n`);
            if (current && current.id !== saved?.line.id) {
              await fs.rm(geometryPath(current.id), { force: true });
            }
            return send(res, 200, updated);
          } catch (error) {
            return send(res, 400, {
              error: error instanceof Error ? error.message : "Failed to edit lines",
            });
          }
        }
        // All requests read the latest file after previous writes finish.
        pending = pending.then(handle).then(() => undefined);
      });
    },
  };
}
