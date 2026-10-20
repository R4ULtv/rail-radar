export class APIError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1_000 : undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

export function shouldRetryApiRequest(failureCount: number, error: Error): boolean {
  return !(error instanceof APIError && error.status === 429) && failureCount < 2;
}

export function isApiRateLimitActive(error: Error | null, errorUpdatedAt: number): boolean {
  return (
    error instanceof APIError &&
    error.status === 429 &&
    Date.now() < errorUpdatedAt + (error.retryAfterMs ?? 30_000)
  );
}
