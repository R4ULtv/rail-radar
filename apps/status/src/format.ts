import type { ProviderHealth } from "@repo/data/status";

export const STATUS_LABELS: Record<ProviderHealth, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Major disruption",
  unknown: "Insufficient data",
};

export const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
export const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
export const milliseconds = (value: number | null) =>
  value === null ? "—" : `${integer.format(value)} ms`;
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});
export const dayLabel = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));
export const timeLabel = (date: string) => `${timeFormat.format(new Date(date))} UTC`;
const observationFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
export const observationLabel = (date: string) => `${observationFormat.format(new Date(date))} UTC`;
export const windowLabel = (minutes: number) =>
  minutes === 60
    ? "last hour"
    : minutes % 60 === 0
      ? `last ${minutes / 60} hours`
      : `last ${minutes} minutes`;
