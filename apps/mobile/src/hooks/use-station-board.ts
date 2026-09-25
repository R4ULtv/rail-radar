import type { Train } from "@repo/data/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

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
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

const refreshIntervalMs = 30_000;
function initialState(key: string): BoardState {
  return { key, data: null, error: null, isLoading: true, isRefreshing: false };
}

export function useStationBoard(stationId: string, type: BoardType, enabled: boolean) {
  const key = `${stationId}:${type}`;
  const [appIsActive, setAppIsActive] = useState(AppState.currentState !== "background");
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<BoardState>(() => initialState(key));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

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
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Live trains could not be loaded.");
        }

        const data = (await response.json()) as BoardResponse;
        if (!Array.isArray(data.trains)) {
          throw new Error("The live board returned an invalid response.");
        }

        if (!cancelled) {
          setState({ key, data, error: null, isLoading: false, isRefreshing: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...(current.key === key ? current : initialState(key)),
            error: error instanceof Error ? error.message : "Live trains could not be loaded.",
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
  }, [stationId, type, enabled, appIsActive, retryCount, key]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const current = state.key === key ? state : null;

  // Stable between refreshes, so the memoized board only re-renders when its data changes.
  return useMemo(() => ({ ...(current ?? initialState(key)), retry }), [current, key, retry]);
}
