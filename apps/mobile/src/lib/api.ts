import { Platform } from "react-native";

import { expo } from "../../app.json";

export const API_BASE_URL = "https://api.railradar24.com";
// React Native's fetch has no timeout option, and on Android a request on a weak signal can hang
// indefinitely, holding up the next refresh.
const requestTimeoutMs = 15_000;

function osVersion() {
  // Android reports its API level as the version; the release is the "15" users know.
  return Platform.OS === "android" ? Platform.constants.Release : Platform.Version;
}

/** Shows up in Cloudflare logs, e.g. "RailRadar/0.1.0 (iOS 18.2)" or "RailRadar/0.1.0 (Android 15)". */
export const USER_AGENT = `RailRadar/${expo.version} (${Platform.OS === "ios" ? "iOS" : "Android"} ${osVersion()})`;

/** Fetches with the app's User-Agent and a timeout; used for the API and the web's photos. */
export function fetchWithUserAgent(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", USER_AGENT);

  // The timeout also covers reading the body; aborting a finished request does nothing.
  const controller = new AbortController();
  setTimeout(() => controller.abort(), requestTimeoutMs);

  const signal = init?.signal;
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", () => controller.abort(), { once: true });

  return fetch(url, { ...init, headers, signal: controller.signal });
}

export function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  return fetchWithUserAgent(`${API_BASE_URL}${path}`, init);
}
