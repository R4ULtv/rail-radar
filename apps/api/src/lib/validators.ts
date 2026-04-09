import { COUNTRY_CODES, type CountryCode } from "@repo/data/countries";
import { validator } from "hono/validator";

import { VALID_PERIODS, type Period } from "../constants";
import { jsonError } from "./http";

export const periodValidator = validator("query", (value, c) => {
  const period = value.period;

  if (period !== undefined && !VALID_PERIODS.includes(period as Period)) {
    return jsonError(c, `Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}`, 400);
  }

  return { period: (period as Period) ?? "day" };
});

export const trainTypeValidator = validator("query", (value, c) => {
  const type = value.type;

  if (type !== undefined && type !== "arrivals" && type !== "departures") {
    return jsonError(c, 'Invalid type. Must be "arrivals" or "departures".', 400);
  }

  return { type: (type ?? "departures") as "arrivals" | "departures" };
});

export const countryParamValidator = validator("param", (value, c) => {
  const country = value.country;

  if (!country || !COUNTRY_CODES.includes(country as CountryCode)) {
    return jsonError(c, `Invalid country. Must be one of: ${COUNTRY_CODES.join(", ")}`, 400);
  }

  return { country: country as CountryCode };
});
