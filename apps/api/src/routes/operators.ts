import { cache } from "hono/cache";

import { COUNTRY_CODES } from "@repo/data/countries";
import {
  operatorBySlug,
  operators,
  type Operator,
  type OperatorCountry,
  type OperatorType,
  type ServiceType,
} from "@repo/data/operators";

import { CACHE_TTL } from "../constants";
import { factory } from "../lib/env";
import { jsonError, parseFilterList, validateFilter } from "../lib/http";

const OPERATOR_COUNTRIES = [
  "international",
  ...COUNTRY_CODES,
] as const satisfies readonly OperatorCountry[];
const OPERATOR_TYPES = [
  "passenger",
  "cargo",
  "metro",
  "light-rail",
] as const satisfies readonly OperatorType[];
const SERVICE_TYPES = [
  "high-speed",
  "intercity",
  "regional",
  "commuter",
  "night-train",
  "international",
  "scenic",
] as const satisfies readonly ServiceType[];

function matchesOperatorQuery(operator: Operator, query: string): boolean {
  const normalizedQuery = query.toLowerCase();

  return [
    operator.slug,
    operator.name,
    operator.description,
    operator.headquarters,
    operator.parentCompany,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export const operatorsRoutes = factory
  .createApp()
  .get(
    "/",
    cache({
      cacheName: "operators-cache",
      cacheControl: CACHE_TTL.OPERATORS,
    }),
    (c) => {
      const countriesResult = validateFilter(
        "country",
        parseFilterList(c.req.query("country")),
        OPERATOR_COUNTRIES,
      );
      if (countriesResult.error) return jsonError(c, countriesResult.error, 400);

      const originResult = validateFilter(
        "origin",
        parseFilterList(c.req.query("origin")),
        OPERATOR_COUNTRIES,
      );
      if (originResult.error) return jsonError(c, originResult.error, 400);

      const operatorTypesResult = validateFilter(
        "type",
        parseFilterList(c.req.query("type")),
        OPERATOR_TYPES,
      );
      if (operatorTypesResult.error) return jsonError(c, operatorTypesResult.error, 400);

      const serviceTypesResult = validateFilter(
        "serviceType",
        parseFilterList(c.req.query("serviceType")),
        SERVICE_TYPES,
      );
      if (serviceTypesResult.error) return jsonError(c, serviceTypesResult.error, 400);

      const query = c.req.query("q")?.trim();
      const filtered = operators.filter((operator) => {
        if (query && !matchesOperatorQuery(operator, query)) return false;
        if (
          countriesResult.values.length > 0 &&
          !countriesResult.values.some((country) => operator.countries.includes(country))
        ) {
          return false;
        }
        if (
          originResult.values.length > 0 &&
          !originResult.values.includes(operator.countries[0] as OperatorCountry)
        ) {
          return false;
        }
        if (
          operatorTypesResult.values.length > 0 &&
          !operatorTypesResult.values.some((type) => operator.operatorTypes.includes(type))
        ) {
          return false;
        }
        if (
          serviceTypesResult.values.length > 0 &&
          !serviceTypesResult.values.some((type) => operator.serviceTypes.includes(type))
        ) {
          return false;
        }
        return true;
      });

      return c.json({
        count: filtered.length,
        operators: filtered,
      });
    },
  )
  .get(
    "/:slug",
    cache({
      cacheName: "operators-cache",
      cacheControl: CACHE_TTL.OPERATORS,
    }),
    (c) => {
      const operator = operatorBySlug.get(c.req.param("slug"));

      if (!operator) {
        return jsonError(c, "Operator not found.", 404);
      }

      return c.json(operator);
    },
  );
