import { jsonResponse, type FetchMock, type RecordedRequest } from "./fetch";

export const ANALYTICS_HOST = "api.cloudflare.com";

/**
 * Serve Analytics Engine SQL queries by matching the SQL text. `routes` maps a substring of
 * the query to its `data` rows; the first match wins.
 */
export function mockAnalytics(fetchMock: FetchMock, routes: [string, unknown[]][]) {
  fetchMock.on(ANALYTICS_HOST, (request: RecordedRequest) => {
    const sql = request.body ?? "";
    const match = routes.find(([needle]) => sql.includes(needle));
    if (!match) throw new Error(`Unexpected analytics query: ${sql}`);
    return jsonResponse({ data: match[1] });
  });
}

/** The SQL bodies sent to Analytics Engine, in order. */
export function analyticsQueries(fetchMock: FetchMock): string[] {
  return fetchMock.requests
    .filter((request) => request.url.includes(ANALYTICS_HOST))
    .map((request) => request.body ?? "");
}
