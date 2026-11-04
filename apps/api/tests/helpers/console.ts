import { vi } from "vitest";

/** Silence and capture structured logs written by the error logger. */
export function captureLogs() {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const parse = (spy: typeof error) =>
    spy.mock.calls.map(([line]) => {
      try {
        return JSON.parse(String(line)) as Record<string, unknown>;
      } catch {
        return { raw: line } as Record<string, unknown>;
      }
    });
  return { error, warn, errors: () => parse(error), warnings: () => parse(warn) };
}
