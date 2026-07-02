export const COUNTRY_MAP = {
  it: "Italy",
  ch: "Switzerland",
  fi: "Finland",
  be: "Belgium",
  nl: "Netherlands",
  uk: "United Kingdom",
  ie: "Ireland",
  no: "Norway",
  se: "Sweden",
  dk: "Denmark",
  de: "Germany",
  pl: "Poland",
  fr: "France",
} as const;

export type CountryCode = keyof typeof COUNTRY_MAP;
export type CountryName = (typeof COUNTRY_MAP)[CountryCode];
export const COUNTRY_CODES = Object.keys(COUNTRY_MAP) as CountryCode[];

/** URL-friendly full-name slug per country, derived from COUNTRY_MAP (e.g. "United Kingdom" -> "united-kingdom") */
export const COUNTRY_SLUG = Object.fromEntries(
  (Object.entries(COUNTRY_MAP) as [CountryCode, CountryName][]).map(([code, name]) => [
    code,
    name.toLowerCase().replace(/\s+/g, "-"),
  ]),
) as Record<CountryCode, string>;

export const COUNTRY_SLUGS = Object.values(COUNTRY_SLUG);

const SLUG_TO_CODE = new Map<string, CountryCode>(
  (Object.entries(COUNTRY_SLUG) as [CountryCode, string][]).map(([code, slug]) => [slug, code]),
);

/** Resolve a country slug (e.g. "switzerland") to its code, or null if unknown */
export function getCountryBySlug(slug: string): CountryCode | null {
  return SLUG_TO_CODE.get(slug) ?? null;
}

/** Get the URL slug for a country code (e.g. "ch" -> "switzerland") */
export function getCountrySlug(code: CountryCode): string {
  return COUNTRY_SLUG[code];
}

const ID_PREFIX_TO_COUNTRY: Record<string, CountryCode> = {
  IT: "it",
  ITM: "it", // Metro
  ITL: "it", // Local-Light
  CH: "ch",
  FI: "fi",
  FIM: "fi",
  BE: "be",
  BEM: "be",
  NL: "nl",
  NLM: "nl",
  UK: "uk",
  UKM: "uk",
  UKL: "uk",
  IE: "ie",
  IEL: "ie",
  NO: "no",
  NOM: "no",
  NOL: "no",
  SE: "se",
  SEM: "se",
  SEL: "se",
  DK: "dk",
  DKM: "dk",
  DE: "de",
  DEM: "de",
  PL: "pl",
  PLM: "pl",
  FR: "fr",
  FRM: "fr",
};

/** Get country from a station ID. Returns code by default, or full name with `format: "name"` */
export function getCountry(stationId: string, options: { format: "name" }): CountryName | null;
export function getCountry(stationId: string, options?: { format: "code" }): CountryCode | null;
export function getCountry(
  stationId: string,
  options?: { format: "code" | "name" },
): CountryCode | CountryName | null {
  const prefix = stationId.match(/^[A-Z]+/)?.[0];
  const code = prefix ? (ID_PREFIX_TO_COUNTRY[prefix] ?? null) : null;
  if (!code) return null;
  return options?.format === "name" ? COUNTRY_MAP[code] : code;
}
