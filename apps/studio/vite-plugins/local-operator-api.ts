import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import type { Line, Operator } from "@repo/data";
import { getOperatorInUseError, replaceOperator, validateOperators } from "../src/lib/operators.ts";

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(
  req: Connect.IncomingMessage,
): Promise<{ operator?: unknown; original?: unknown }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid operator payload");
  return body;
}

/** Local development only: atomic profile writes with stale-edit and line-reference checks. */
export function localOperatorApi(options?: {
  operatorsPath?: string;
  linesPath?: string;
  logosDirectory?: string;
}): Plugin {
  const operatorsPath =
    options?.operatorsPath ?? path.resolve(process.cwd(), "../../packages/data/src/operators.json");
  const linesPath =
    options?.linesPath ?? path.resolve(process.cwd(), "../../packages/data/src/lines.json");
  const logosDirectory =
    options?.logosDirectory ?? path.resolve(process.cwd(), "../web/public/assets/operators");
  let pending = Promise.resolve();
  return {
    name: "studio-local-operator-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (
          url !== "/api/operators" &&
          !url?.startsWith("/api/operators/") &&
          !url?.startsWith("/api/operator-logos/")
        )
          return next();
        async function handle() {
          try {
            if (url?.startsWith("/api/operator-logos/")) {
              const logoPath = decodeURIComponent(url.slice("/api/operator-logos/".length));
              if (req.method !== "GET" || !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.svg$/.test(logoPath))
                return send(res, 400, { error: "Invalid operator logo path" });
              try {
                const svg = await fs.readFile(path.join(logosDirectory, logoPath));
                res.setHeader("content-type", "image/svg+xml");
                res.setHeader("cache-control", "no-store");
                res.end(svg);
                return;
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT")
                  return send(res, 404, { error: "Logo not found" });
                throw error;
              }
            }
            const rawOperators: Operator[] = JSON.parse(await fs.readFile(operatorsPath, "utf8"));
            const operators = validateOperators(rawOperators);
            if (url === "/api/operators" && req.method === "GET") return send(res, 200, operators);
            const match = url?.match(/^\/api\/operators\/([^/]+)$/);
            if (!match || (req.method !== "PUT" && req.method !== "DELETE"))
              return send(res, 405, { error: "Unsupported operator operation" });
            const slug = decodeURIComponent(match[1]!);
            const body = await readBody(req);
            const current = operators.find((operator) => operator.slug === slug) ?? null;
            if (!isDeepStrictEqual(current, body.original))
              return send(res, 409, {
                error: "This operator changed on disk. Reload the operators before saving again.",
              });
            let updated = rawOperators.filter((operator) => operator.slug !== slug);
            const operator = req.method === "PUT" ? validateOperators([body.operator])[0]! : null;
            if (current && (!operator || operator.slug !== current.slug)) {
              const lines: Line[] = JSON.parse(await fs.readFile(linesPath, "utf8"));
              const inUseError = getOperatorInUseError(lines, current.slug);
              if (inUseError) return send(res, 409, { error: inUseError });
            }
            if (operator) updated = replaceOperator(rawOperators, slug, operator);
            else if (!current) return send(res, 404, { error: "Operator not found" });
            const temporaryPath = `${operatorsPath}.${randomUUID()}.studio-tmp`;
            try {
              await fs.writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
              await fs.rename(temporaryPath, operatorsPath);
            } finally {
              await fs.rm(temporaryPath, { force: true });
            }
            return send(res, 200, updated);
          } catch (error) {
            return send(res, 400, {
              error: error instanceof Error ? error.message : "Failed to edit operators",
            });
          }
        }
        pending = pending.then(handle).then(() => undefined);
      });
    },
  };
}
