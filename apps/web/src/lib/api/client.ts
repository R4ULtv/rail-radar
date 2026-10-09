import { env } from "@/lib/env";
import { APIError, parseRetryAfterMs } from "./error";

export { APIError } from "./error";

/**
 * Core API client for Rail Radar
 * Provides centralized fetch and error handling for TanStack Query hooks.
 */

/**
 * Builds full API URL from relative path
 */
export function buildApiUrl(path: string): string {
  const baseUrl = env.apiUrl;

  if (!baseUrl) {
    throw new Error("VITE_API_URL environment variable is not defined");
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

/**
 * Generic JSON fetcher with consistent error handling.
 * Parses API errors from response JSON and provides structured error info
 */
export async function apiFetcher<T>(
  url: string,
  options?: Pick<RequestInit, "signal" | "cache">,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    // Try to parse API error from response
    let errorMessage = response.statusText || "An error occurred";

    try {
      const errorData: unknown = await response.json();
      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData &&
        typeof errorData.error === "string"
      ) {
        errorMessage = errorData.error;
      }
    } catch {
      // If JSON parsing fails, use status text
    }

    throw new APIError(
      errorMessage,
      response.status,
      parseRetryAfterMs(response.headers.get("Retry-After")),
    );
  }

  return response.json();
}
