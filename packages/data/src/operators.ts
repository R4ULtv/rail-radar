import operatorsData from "./operators.json" with { type: "json" };
import type { Operator } from "./types";

export type { Operator } from "./types";

export const operators = operatorsData as Operator[];

export const operatorBySlug = new Map<string, Operator>(
  operators.map((operator) => [operator.slug, operator]),
);
