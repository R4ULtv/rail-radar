import { env } from "@/lib/env";

/**
 * Core API client for Rail Radar
 * Provides centralized fetch and error handling for TanStack Query hooks.
 */

/**
 * Custom error class for API errors with status codes
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "APIError";
  }
}

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
export async function apiFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

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

    throw new APIError(errorMessage, response.status);
  }

  return response.json();
}
