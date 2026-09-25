import type { Train } from "@repo/data/types";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppIsActive } from "@/hooks/use-app-is-active";
import { useIsOnline } from "@/hooks/use-is-online";
import { fetchApi } from "@/lib/api";

export type BoardType = "departures" | "arrivals";

interface BoardResponse {
  timestamp: string;
  info: string | null;
  trains: Train[];
}

interface BoardState {
  key: string;
  data: BoardResponse | null;
  /** The last load failed; `message` is the API's reason, or null if the API wasn't reached. */
  error: { message: string | null } | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

const refreshIntervalMs = 30_000;

const fallbackMessage = "Live trains could not be loaded. Please try again in a moment.";

/** The API answered, but with an error or something that isn't a board. */
class ApiError extends Error {}

function initialState(key: string): BoardState {
  return { key, data: null, error: null, isLoading: true, isRefreshing: false };
}

export function useStationBoard(stationId: string, type: BoardType, enabled: boolean) {
  const key = `${stationId}:${type}`;
  const appIsActive = useAppIsActive();
  const isOnline = useIsOnline();
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<BoardState>(() => initialState(key));

  useEffect(() => {
    if (!enabled || !appIsActive) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      controller = new AbortController();
      setState((current) => ({
        ...(current.key === key ? current : initialState(key)),
        error: null,
        isLoading: current.key !== key || current.data === null,
        isRefreshing: current.key === key && current.data !== null,
      }));

      try {
        const response = await fetchApi(`/stations/${encodeURIComponent(stationId)}?type=${type}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
          throw new ApiError(typeof body?.error === "string" ? body.error : fallbackMessage);
        }

        const data = (await response.json()) as BoardResponse;
        if (!Array.isArray(data.trains)) throw new ApiError(fallbackMessage);

        if (!cancelled) {
          setState({ key, data, error: null, isLoading: false, isRefreshing: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...(current.key === key ? current : initialState(key)),
            // Anything else is a network failure or a timeout.
            error: { message: error instanceof ApiError ? error.message : null },
            isLoading: false,
            isRefreshing: false,
          }));
        }
      } finally {
        if (!cancelled) timeout = setTimeout(() => void load(), refreshIntervalMs);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timeout) clearTimeout(timeout);
    };
    // Reloads straight away when the connection comes back, or drops, so the message is current.
  }, [stationId, type, enabled, appIsActive, isOnline, retryCount, key]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const current = state.key === key ? state : null;

  // Stable between refreshes, so the memoized board only re-renders when its data changes.
  return useMemo(
    () => ({ ...(current ?? initialState(key)), isOnline, retry }),
    [current, key, isOnline, retry],
  );
}
