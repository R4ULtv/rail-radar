import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonError(c: Context, error: string, status: ContentfulStatusCode) {
  return c.json({ error }, status);
}

export function parseFilterList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function validateFilter<T extends string>(
  name: string,
  values: string[],
  validValues: readonly T[],
): { values: T[]; error: string | null } {
  const invalid = values.filter((value) => !validValues.includes(value as T));

  if (invalid.length > 0) {
    return {
      values: [],
      error: `Invalid ${name}. Must be one of: ${validValues.join(", ")}`,
    };
  }

  return { values: values as T[], error: null };
}
