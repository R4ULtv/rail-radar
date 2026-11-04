import { vi } from "vitest";

/**
 * Freeze `Date.now()`/`new Date()` at `iso` while leaving timers real, so fetch timeouts and
 * promises behave normally. Fake timers are restored by `vi.useRealTimers()` in afterEach.
 */
export function freezeTime(iso: string): number {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });
  return Date.now();
}

/** ISO string `minutes` from the frozen now (negative for the past). */
export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Epoch seconds `minutes` from the frozen now, as several providers send them. */
export function epochSecondsFromNow(minutes: number): number {
  return Math.floor((Date.now() + minutes * 60_000) / 1000);
}
