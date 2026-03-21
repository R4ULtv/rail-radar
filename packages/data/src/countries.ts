export const COUNTRY_MAP = {
  it: "Italy",
  ch: "Switzerland",
  fi: "Finland",
  be: "Belgium",
  nl: "Netherlands",
  uk: "United Kingdom",
  ie: "Ireland",
} as const;

export type CountryCode = keyof typeof COUNTRY_MAP;
export type CountryName = (typeof COUNTRY_MAP)[CountryCode];
export const COUNTRY_CODES = Object.keys(COUNTRY_MAP) as CountryCode[];

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
