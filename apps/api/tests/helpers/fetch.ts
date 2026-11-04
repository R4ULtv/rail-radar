import { vi } from "vitest";

export type RecordedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
};

type Responder = Response | ((request: RecordedRequest) => Response | Promise<Response>);

/** A responder that never answers, for exercising fetch timeouts. */
export const hang: Responder = () => new Promise<Response>(() => {});

type Route = {
  match: (url: string) => boolean;
  respond: Responder;
  once: boolean;
};

/** A JSON response with the given status (200 by default). */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers,
  });
}

/** A text/XML/HTML response with the given status (200 by default). */
export function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

/**
 * Replace `globalThis.fetch` with a router of canned responses and record every request.
 * Routes match on a URL substring or predicate; the first matching route wins, and `once`
 * routes are consumed. Unmatched requests fail the test loudly instead of hitting the network.
 */
export function mockFetch() {
  const routes: Route[] = [];
  const requests: RecordedRequest[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const recorded: RecordedRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: init?.body == null ? null : await request.clone().text(),
    };
    requests.push(recorded);

    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const index = routes.findIndex((route) => route.match(recorded.url));
    if (index === -1)
      throw new Error(`Unexpected fetch in test: ${recorded.method} ${recorded.url}`);

    const route = routes[index]!;
    if (route.once) routes.splice(index, 1);
    const pending = Promise.resolve(
      typeof route.respond === "function" ? route.respond(recorded) : route.respond,
    );
    // Honour the caller's AbortSignal like real fetch, so timeout paths can be exercised.
    const signal = init?.signal;
    const response = signal
      ? await Promise.race([
          pending,
          new Promise<never>((_, reject) =>
            signal.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted.", "AbortError")),
            ),
          ),
        ])
      : await pending;
    // A Response body can be read once; hand out a copy so a route can serve several requests.
    return response.clone();
  });

  vi.stubGlobal("fetch", fetchMock);

  const toMatcher = (pattern: string | RegExp | ((url: string) => boolean)) =>
    typeof pattern === "function"
      ? pattern
      : typeof pattern === "string"
        ? (url: string) => url.includes(pattern)
        : (url: string) => pattern.test(url);

  const api = {
    fetch: fetchMock,
    requests,
    /** Serve `respond` for every request whose URL matches `pattern`. */
    on(pattern: string | RegExp | ((url: string) => boolean), respond: Responder) {
      routes.push({ match: toMatcher(pattern), respond, once: false });
      return api;
    },
    /** Serve `respond` for the next matching request only. */
    once(pattern: string | RegExp | ((url: string) => boolean), respond: Responder) {
      routes.push({ match: toMatcher(pattern), respond, once: true });
      return api;
    },
    /** Make every request reject with `error` (a network failure by default). */
    fail(error: unknown = new TypeError("fetch failed")) {
      fetchMock.mockImplementation(async () => {
        throw error;
      });
      return api;
    },
    /** Parsed URL of the n-th request (0-based). */
    url(n = 0) {
      const request = requests[n];
      if (!request) throw new Error(`No request #${n}; got ${requests.length}`);
      return new URL(request.url);
    },
  };

  return api;
}

export type FetchMock = ReturnType<typeof mockFetch>;
