import type { Context } from "hono";
import { routePath } from "hono/route";
import { ScraperError } from "../scrapers/core";
import type { Env } from "./env";

type ErrorDetails = {
  name: string;
  message: string;
  stack?: string;
  cause?: ErrorDetails;
};

function sanitizeErrorText(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"']+/g, (value) => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "[invalid URL]";
    }
  });
}

function describeError(error: unknown, depth = 0): ErrorDetails {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: sanitizeErrorText(String(error)) };
  }

  return {
    name: error.name,
    message: sanitizeErrorText(error.message),
    stack: error.stack === undefined ? undefined : sanitizeErrorText(error.stack),
    ...(error.cause !== undefined && depth < 3
      ? { cause: describeError(error.cause, depth + 1) }
      : {}),
  };
}

/** Keep request bodies, headers, and query strings (which can contain credentials) out of logs. */
export function logRequestError(
  c: Context<Env>,
  error: unknown,
  message: string,
  details: Record<string, string | number | null | undefined> = {},
) {
  const requestId = c.get("requestId") ?? c.req.header("cf-ray") ?? crypto.randomUUID();
  const startedAt = c.get("requestStartedAt");
  c.header("X-Request-Id", requestId);

  console.error(
    JSON.stringify({
      message,
      service: "api",
      requestId,
      method: c.req.method,
      path: c.req.path,
      route: routePath(c, -1),
      durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
      status: error instanceof ScraperError ? error.statusCode : 500,
      fetchMs: error instanceof ScraperError ? error.timing?.fetchMs : undefined,
      upstream: error instanceof ScraperError ? error.upstream : undefined,
      ...details,
      error: describeError(error),
    }),
  );
}
