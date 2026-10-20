import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useHydrated } from "@tanstack/react-router";

/** How long typing has to pause before the URL catches up with the search box. */
const URL_SYNC_DELAY = 300;

/**
 * The search box of a directory page (`/lines`, `/operators`). Typing stays local so
 * the caret never waits on the list, which renders from `deferredQuery` and can be
 * interrupted by the next keystroke. The URL follows once typing pauses: every URL
 * change makes each link on the page rebuild its href, which on a directory of a few
 * hundred cards costs as much as rendering them.
 */
export function useDirectoryQuery(
  urlQuery: string | undefined,
  syncUrl: (query: string | undefined) => void,
) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const syncUrlRef = useRef(syncUrl);
  const pendingUrlQueries = useRef<(string | undefined)[]>([]);

  useEffect(() => {
    syncUrlRef.current = syncUrl;
  });

  useEffect(() => {
    if (!hydrated) return;
    // Our debounced navigation may finish after more typing. Its echo must not
    // replace the newer input, while other navigation should seed the search box.
    const pending = pendingUrlQueries.current;
    const index = pending.indexOf(urlQuery);
    if (index !== -1) {
      pending.splice(0, index + 1);
      return;
    }
    pending.length = 0;
    setQuery(urlQuery ?? "");
  }, [hydrated, urlQuery]);

  useEffect(() => {
    if (!hydrated || (query || undefined) === urlQuery) return;
    const timer = setTimeout(() => {
      pendingUrlQueries.current.push(query || undefined);
      syncUrlRef.current(query || undefined);
    }, URL_SYNC_DELAY);
    return () => clearTimeout(timer);
  }, [hydrated, query, urlQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { hydrated, query, deferredQuery, setQuery, inputRef };
}
