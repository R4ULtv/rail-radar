export const COUNTRY_MAP = {
  it: "Italy",
  ch: "Switzerland",
  fi: "Finland",
  be: "Belgium",
  nl: "Netherlands",
  uk: "United Kingdom",
  ie: "Ireland",
  lu: "Luxembourg",
  no: "Norway",
  se: "Sweden",
  dk: "Denmark",
  de: "Germany",
  pl: "Poland",
  fr: "France",
  hu: "Hungary",
} as const;

export type CountryCode = keyof typeof COUNTRY_MAP;
export type CountryName = (typeof COUNTRY_MAP)[CountryCode];
export const COUNTRY_CODES = Object.keys(COUNTRY_MAP) as CountryCode[];

/**
 * Known rail data-quality issues per country, shown on rail station pages and on the status
 * page for the country's provider. Remove an entry once the issue is resolved.
 */
export const RAIL_DATA_WARNINGS: Partial<Record<CountryCode, string>> = {
  pl: "Live data for stations in Poland may be unstable or incomplete right now. We are working to improve it.",
  ie: "Platform information is currently unavailable for stations in Ireland. We are working to improve it.",
  fr: "Platform and origin information may be missing for stations in France. We are working to improve it.",
  lu: "Live arrivals are not available yet for train stations in Luxembourg. We are working to add them.",
};

/**
 * Countries whose rail data source went live recently, by go-live date (UTC). Rail station pages
 * and the status page flag these as new for NEW_RAIL_DATA_DAYS, then the flag lapses on its own;
 * remove the entry afterwards.
 */
export const NEW_RAIL_DATA: Partial<Record<CountryCode, string>> = {
  hu: "2026-11-06",
};
export const NEW_RAIL_DATA_DAYS = 30;

/**
 * Whether a country's rail data is still flagged as new at `now` (epoch ms). Pass 0 before
 * hydration so prerendered HTML matches the first client render; listed countries count as new.
 */
export function isNewRailData(country: CountryCode, now: number): boolean {
  const since = NEW_RAIL_DATA[country];
  if (since === undefined) return false;
  return now < Date.parse(`${since}T00:00:00Z`) + NEW_RAIL_DATA_DAYS * 86_400_000;
}

export function newRailDataNotice(country: CountryCode): string {
  return `Live data for stations in ${COUNTRY_MAP[country]} is new and may be incomplete or inaccurate while we improve it.`;
}

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

const ID_PREFIX_TO_COUNTRY = Object.fromEntries(
  COUNTRY_CODES.flatMap((code) => {
    const prefix = code.toUpperCase();
    return [
      [prefix, code],
      [`${prefix}M`, code],
      [`${prefix}L`, code],
      [`${prefix}F`, code],
    ];
  }),
) as Record<string, CountryCode>;

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
