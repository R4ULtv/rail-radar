import { beforeEach, vi } from "vitest";

/**
 * Per-test isolation for the real Workers Cache API. The runtime's caches outlive a test (and a
 * test file) and can be neither listed nor cleared, so before every test `caches.open(name)` is
 * routed to a fresh, uniquely named cache. Entries still go through workerd's real Cache API
 * (Cache-Control handling, refusal of uncacheable responses), and stored keys are recorded so
 * tests can assert what was cached.
 *
 * With `isolate: false` this module is evaluated again for every test file in the same runtime,
 * while `caches` is still stubbed. The runtime's CacheStorage and the recorded keys therefore
 * live on a global, so a new evaluation never wraps a previous wrapper or reads stale keys.
 */
type CacheTestState = {
  runtimeCaches: CacheStorage;
  storedKeys: Map<string, Set<string>>;
  namespace: string;
};
const STATE = Symbol.for("rail-radar.tests.cache-storage");
const state: CacheTestState = ((globalThis as { [STATE]?: CacheTestState })[STATE] ??= {
  runtimeCaches: caches,
  storedKeys: new Map(),
  namespace: "",
});
const { runtimeCaches, storedKeys } = state;

const keyOf = (request: RequestInfo | URL) =>
  request instanceof Request ? request.url : String(request);

function trackedCache(name: string, cache: Cache): Cache {
  let keys = storedKeys.get(name);
  if (!keys) storedKeys.set(name, (keys = new Set()));
  return {
    match: (request, options) => cache.match(request, options),
    async put(request, response) {
      await cache.put(request, response);
      // Only record what the runtime actually kept.
      if (await cache.match(request)) keys.add(keyOf(request));
    },
    async delete(request, options) {
      keys.delete(keyOf(request));
      return cache.delete(request, options);
    },
  };
}

beforeEach(() => {
  state.namespace = crypto.randomUUID();
  storedKeys.clear();
  vi.stubGlobal("caches", {
    default: runtimeCaches.default,
    open: async (name: string) =>
      trackedCache(name, await runtimeCaches.open(`${state.namespace}/${name}`)),
  } satisfies CacheStorage);
});

/** Request URLs currently stored in the named cache during this test. */
export function cachedKeys(name: string): string[] {
  return [...(storedKeys.get(name) ?? [])];
}
