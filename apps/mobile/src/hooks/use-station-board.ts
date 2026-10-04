import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppIsActive } from "@/hooks/use-app-is-active";
import { useIsOnline } from "@/hooks/use-is-online";
import { fetchApi } from "@/lib/api";
import { boardRefreshDelay } from "@/lib/board-refresh";
import { stationBoardCache, type BoardResponse, type BoardType } from "@/lib/station-board-cache";

export type { BoardType } from "@/lib/station-board-cache";

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
  const data = stationBoardCache.peek(key)?.data ?? null;
  return { key, data, error: null, isLoading: data === null, isRefreshing: false };
}

export function useStationBoard(stationId: string, type: BoardType, enabled: boolean) {
  const key = `${stationId}:${type}`;
  const appIsActive = useAppIsActive();
  const isOnline = useIsOnline();
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<BoardState>(() => initialState(key));
  const lastRetryCount = useRef(retryCount);
  const wasOnline = useRef(isOnline);
  const wasActive = useRef(appIsActive);

  useEffect(() => {
    // Resume also refetches: monotonic clocks can pause during device sleep.
    const resumed = appIsActive && !wasActive.current;
    const forceRefresh =
      retryCount !== lastRetryCount.current ||
      isOnline !== wasOnline.current ||
      resumed ||
      !isOnline;
    lastRetryCount.current = retryCount;
    wasOnline.current = isOnline;
    wasActive.current = appIsActive;
    if (resumed) stationBoardCache.expire();
    if (!enabled || !appIsActive) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      let nextRefreshIntervalMs = refreshIntervalMs;
      controller = new AbortController();
      setState((current) => {
        const next = current.key === key ? current : initialState(key);
        return {
          ...next,
          error: null,
          isLoading: next.data === null,
          isRefreshing: next.data !== null,
        };
      });

      try {
        const response = await fetchApi(`/stations/${encodeURIComponent(stationId)}?type=${type}`, {
          signal: controller.signal,
          // React Native's `cache: "no-store"` adds a query parameter, bypassing the shared API cache.
          headers: { "Cache-Control": "no-cache, no-store" },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
          throw new ApiError(typeof body?.error === "string" ? body.error : fallbackMessage);
        }

        const data = (await response.json()) as BoardResponse;
        if (!Array.isArray(data.trains)) throw new ApiError(fallbackMessage);

        nextRefreshIntervalMs = boardRefreshDelay(data.timestamp ?? "", response.headers);

        if (!cancelled) {
          stationBoardCache.set(key, data, nextRefreshIntervalMs);
          setState({
            key,
            data,
            error: null,
            isLoading: false,
            isRefreshing: false,
          });
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
        if (!cancelled) timeout = setTimeout(() => void load(), nextRefreshIntervalMs);
      }
    }

    const cached = stationBoardCache.get(key);
    const remainingMs = cached && !forceRefresh ? cached.refreshAt - performance.now() : 0;
    if (cached && remainingMs > 0) {
      // Returning to a fresh board shows it immediately and keeps its original refresh deadline.
      setState((current) =>
        current.key === key &&
        current.data === cached.data &&
        current.error === null &&
        !current.isLoading &&
        !current.isRefreshing
          ? current
          : initialState(key),
      );
      timeout = setTimeout(() => void load(), remainingMs);
    } else {
      void load();
    }
    return () => {
      cancelled = true;
      controller?.abort();
      if (timeout) clearTimeout(timeout);
    };
    // Reloads straight away when the connection comes back, or drops, so the message is current.
  }, [stationId, type, enabled, appIsActive, isOnline, retryCount, key]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  // Stable between refreshes, so the memoized board only re-renders when its data changes.
  return useMemo(() => {
    const board = state.key === key ? state : initialState(key);
    return { ...board, isOnline, retry };
  }, [state, key, isOnline, retry]);
}
