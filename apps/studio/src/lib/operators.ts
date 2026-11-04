import type { Line, Operator, OperatorCountry, OperatorType, ServiceType } from "@repo/data";
import { COUNTRY_MAP } from "@repo/data/countries";

export const operatorTypeLabels: Record<OperatorType, string> = {
  passenger: "Passenger",
  freight: "Freight",
  metro: "Metro",
  "light-rail": "Light rail",
};

export const serviceTypeLabels: Record<ServiceType, string> = {
  "high-speed": "High speed",
  intercity: "Intercity",
  regional: "Regional",
  commuter: "Commuter",
  "night-train": "Night train",
  international: "International",
  scenic: "Scenic",
  intermodal: "Intermodal",
  wagonload: "Wagonload",
  "block-train": "Block train",
};

export const operatorCountryLabels: Record<OperatorCountry, string> = {
  ...COUNTRY_MAP,
  international: "International",
};

export const operatorLinkTypes = ["website", "timetables", "api", "wikipedia"] as const;
export type OperatorTypeFilter = "all" | OperatorType;
export type OperatorCountryFilter = "all" | OperatorCountry;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, allowed: string[], label: string) {
  const unsupported = Object.keys(value).find((key) => !allowed.includes(key));
  if (unsupported) throw new Error(`${label}: unsupported field "${unsupported}"`);
}

function text(value: unknown, label: string, required = true): string {
  if (typeof value !== "string" || (required && !value.trim()))
    throw new Error(`${label} is required`);
  return value.trim();
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label, false);
}

function url(value: unknown, label: string): string {
  const input = text(value, label);
  try {
    const parsed = new URL(input);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    )
      return input;
  } catch {
    /* Report the same actionable error for every malformed URL. */
  }
  throw new Error(`${label} must be an http or https URL`);
}

function number(value: unknown, label: string, integer = false): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isSafeInteger(value))
  ) {
    throw new Error(`${label} must be a non-negative ${integer ? "integer" : "number"}, or null`);
  }
  return value;
}

function choices<T extends string>(
  value: unknown,
  labels: Record<T, string>,
  label: string,
  required = false,
): T[] {
  if (!Array.isArray(value) || (required && !value.length))
    throw new Error(`${label}: select ${required ? "at least one value" : "valid values"}`);
  if (value.some((item) => typeof item !== "string" || !Object.hasOwn(labels, item)))
    throw new Error(`${label} contains an unsupported value`);
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate values`);
  return [...value] as T[];
}

/** Validate imported and edited profiles without silently dropping unsupported data. */
export function validateOperators(value: unknown): Operator[] {
  if (!Array.isArray(value)) throw new Error("Operators must be a JSON array");
  const slugs = new Set<string>();
  return value.map((entry, index) => {
    const operator = object(entry, `Operator ${index + 1}`);
    fields(
      operator,
      [
        "slug",
        "name",
        "logoPath",
        "countries",
        "operatorTypes",
        "bounds",
        "description",
        "website",
        "founded",
        "headquarters",
        "networkKm",
        "annualPassengers",
        "serviceTypes",
        "parentCompany",
        "links",
      ],
      `Operator ${index + 1}`,
    );
    const slug = text(operator.slug, "Operator slug");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error("Operator slug must use lowercase letters, numbers and single hyphens");
    if (slugs.has(slug)) throw new Error(`Duplicate operator slug: ${slug}`);
    slugs.add(slug);
    const logoPath = text(operator.logoPath, `${slug}: logo path`);
    if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(logoPath))
      throw new Error(
        `${slug}: logo path must be a relative asset path without .svg, e.g. it/trenitalia`,
      );
    const bounds = operator.bounds;
    if (
      !Array.isArray(bounds) ||
      bounds.length !== 4 ||
      bounds.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate)) ||
      bounds[0] < -180 ||
      bounds[2] > 180 ||
      bounds[1] < -90 ||
      bounds[3] > 90 ||
      bounds[0] >= bounds[2] ||
      bounds[1] >= bounds[3]
    ) {
      throw new Error(
        `${slug}: bounds must be [west, south, east, north] with valid coordinates, west < east and south < north`,
      );
    }
    if (!Array.isArray(operator.links)) throw new Error(`${slug}: links must be an array`);
    const links = operator.links.map((entry, linkIndex) => {
      const label = `${slug}: link ${linkIndex + 1}`;
      const link = object(entry, label);
      fields(link, ["label", "url", "type"], label);
      if (!operatorLinkTypes.includes(link.type as Operator["links"][number]["type"]))
        throw new Error(`${label} has an unsupported type`);
      return {
        label: text(link.label, `${label} label`),
        url: url(link.url, `${label} URL`),
        type: link.type as Operator["links"][number]["type"],
      };
    });
    return {
      slug,
      name: text(operator.name, `${slug}: name`),
      logoPath,
      countries: choices(operator.countries, operatorCountryLabels, `${slug}: countries`, true),
      operatorTypes: choices(
        operator.operatorTypes,
        operatorTypeLabels,
        `${slug}: operator types`,
        true,
      ),
      bounds: [...bounds] as Operator["bounds"],
      description: text(operator.description, `${slug}: description`, false),
      website: url(operator.website, `${slug}: website`),
      founded: number(operator.founded, `${slug}: founded`, true),
      headquarters: nullableText(operator.headquarters, `${slug}: headquarters`),
      networkKm: number(operator.networkKm, `${slug}: network length`),
      annualPassengers: number(operator.annualPassengers, `${slug}: annual passengers`, true),
      serviceTypes: choices(operator.serviceTypes, serviceTypeLabels, `${slug}: service types`),
      parentCompany: nullableText(operator.parentCompany ?? null, `${slug}: parent company`),
      links,
    };
  });
}

export function createOperator(type: OperatorType = "passenger"): Operator {
  return {
    slug: "",
    name: "",
    logoPath: "",
    countries: [],
    operatorTypes: [type],
    bounds: [0, 0, 0, 0],
    description: "",
    website: "",
    founded: null,
    headquarters: null,
    networkKm: null,
    annualPassengers: null,
    serviceTypes: [],
    parentCompany: null,
    links: [],
  };
}

export function operatorMatchesFilters(
  operator: Operator,
  search: string,
  type: OperatorTypeFilter,
  country: OperatorCountryFilter,
): boolean {
  return (
    (type === "all" || operator.operatorTypes.includes(type)) &&
    (country === "all" || operator.countries.includes(country)) &&
    `${operator.slug} ${operator.name} ${operator.countries.map((code) => operatorCountryLabels[code]).join(" ")}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  );
}

/** Referenced slugs must stay stable; line assignments can be edited in the Lines workspace. */
export function getOperatorInUseError(
  lines: Pick<Line, "operator" | "name">[],
  slug: string,
): string | null {
  const names = lines.filter((line) => line.operator === slug).map((line) => line.name);
  return names.length
    ? `Operator is used by ${names.join(", ")}. Reassign those lines in the Lines workspace before renaming or deleting this operator.`
    : null;
}

/** Preserve editorial order and untouched profiles; append newly created operators. */
export function replaceOperator(
  operators: Operator[],
  originalSlug: string,
  operator: Operator,
): Operator[] {
  const index = operators.findIndex((entry) => entry.slug === originalSlug);
  const updated = [...operators];
  const normalized = validateOperators([operator])[0]!;
  if (index === -1) updated.push(normalized);
  else updated[index] = normalized;
  validateOperators(updated);
  return updated;
}
