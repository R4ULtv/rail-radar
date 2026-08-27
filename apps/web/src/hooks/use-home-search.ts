import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

export type HomeSearch = {
  lat?: number;
  lng?: number;
  zoom?: number;
  station?: string;
  q?: string;
};

export function useHomeSearch() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });

  const setSearch = useCallback(
    (updates: Partial<Record<keyof HomeSearch, string | number | null>>, replace = true) =>
      navigate({
        replace,
        resetScroll: false,
        search: (current) => {
          const next = { ...current, ...updates } as Record<string, unknown>;
          for (const [key, value] of Object.entries(next)) {
            if (value === null || value === undefined || value === "") delete next[key];
          }
          return next as HomeSearch;
        },
      }),
    [navigate],
  );

  return { search, setSearch };
}
