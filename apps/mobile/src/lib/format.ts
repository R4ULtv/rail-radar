// Created once: toLocaleString builds a new formatter on every call, which is slow on the
// device's JS engine.
const countFormat = new Intl.NumberFormat();

/** A count with the device's digit grouping, like toLocaleString. */
export function formatCount(count: number) {
  return countFormat.format(count);
}
