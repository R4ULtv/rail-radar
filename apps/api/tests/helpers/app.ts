import app from "../../src/index";
import { createEnv, createExecutionCtx } from "./env";

export { cachedKeys } from "./cache-storage";

/**
 * Send a request through the full Hono app (middleware, routing, error handling) with mock
 * bindings, then settle its `waitUntil` work. Paths resolve against the production origin.
 */
export async function request(
  path: string,
  init: RequestInit & { ip?: string | null } = {},
  env = createEnv(),
  ctx = createExecutionCtx(),
) {
  const { ip = "203.0.113.7", ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (ip) headers.set("cf-connecting-ip", ip);

  const response = await app.request(
    new URL(path, "https://api.railradar24.com").toString(),
    { ...requestInit, headers },
    env,
    ctx,
  );
  await ctx.flush();
  return { response, env, ctx };
}
