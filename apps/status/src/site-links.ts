import { getCountrySlug, type CountryCode } from "@repo/data/countries";

export const MAIN_WEBSITE = "https://www.railradar24.com";

export type SharedAssetPath =
  | `/flags/${string}.svg`
  | `/operators/${string}.svg`
  | `/providers/${string}.${"svg" | "png"}`;

/** One source of artwork: the web app in dev, the public asset origin in production. */
export function sharedAssetUrl(path: SharedAssetPath) {
  // Vite replaces this built-in flag at build time; it is not a process environment dependency.
  // oxlint-disable-next-line turbo/no-undeclared-env-vars
  return import.meta.env.DEV ? `/__shared-assets${path}` : `${MAIN_WEBSITE}/assets${path}`;
}

export function countryStationsUrl(country: CountryCode) {
  return `${MAIN_WEBSITE}/stations/${getCountrySlug(country)}`;
}
