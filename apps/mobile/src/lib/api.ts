export const API_BASE_URL = "https://api.railradar24.com";
export const CLIENT_HEADER = "X-RailRadar-Client";
export const CLIENT_VALUE = "mobile";

export function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set(CLIENT_HEADER, CLIENT_VALUE);

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
