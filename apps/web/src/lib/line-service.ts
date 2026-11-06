import type { CountryCode } from "@repo/data/countries";
import type { LineServicePeriod, Weekday } from "@repo/data";
import { useEffect, useState } from "react";

const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Service times are local to the line, whatever the reader's clock says. */
const TIME_ZONES: Record<CountryCode, string> = {
  it: "Europe/Rome",
  ch: "Europe/Zurich",
  fi: "Europe/Helsinki",
  be: "Europe/Brussels",
  nl: "Europe/Amsterdam",
  uk: "Europe/London",
  ie: "Europe/Dublin",
  lu: "Europe/Luxembourg",
  no: "Europe/Oslo",
  se: "Europe/Stockholm",
  dk: "Europe/Copenhagen",
  de: "Europe/Berlin",
  pl: "Europe/Warsaw",
  fr: "Europe/Paris",
  hu: "Europe/Budapest",
};

/** Indexes of the weekdays a period covers, Monday first. */
function dayIndexes(days: LineServicePeriod["days"]): number[] {
  const [first, last = first] = days.split("-") as [Weekday, Weekday?];
  const start = WEEKDAYS.indexOf(first);
  const end = WEEKDAYS.indexOf(last);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

/** "Mon–Thu", "Sat", or "Daily" for the whole week. */
export function formatDays(days: LineServicePeriod["days"]): string {
  if (days === "mon-sun") return "Daily";
  const indexes = dayIndexes(days);
  const first = DAY_NAMES[indexes[0]!]!;
  return indexes.length === 1 ? first : `${first}–${DAY_NAMES[indexes.at(-1)!]}`;
}

/** "05:30 – 00:40", with the night services that carry on past or from midnight. */
export function formatHours({ from, to }: LineServicePeriod): string {
  if (from === null && to === null) return "24 hours";
  if (from === null) return `Until ${to}`;
  if (to === null) return `${from} – all night`;
  return `${from} – ${to}`;
}

function formatMinutes(minutes: number): string {
  return minutes >= 120 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

/** "every 2–5 min", "every 10 min", "every 15 min – 2 h". */
export function formatEvery([shortest, longest]: LineServicePeriod["every"]): string {
  if (shortest === longest) return `every ${formatMinutes(shortest)}`;
  const long = formatMinutes(longest);
  const short = formatMinutes(shortest);
  // Share the unit when both ends use it: "2–5 min" rather than "2 min – 5 min".
  if (short.split(" ")[1] === long.split(" ")[1]) {
    return `every ${short.split(" ")[0]}–${long}`;
  }
  return `every ${short} – ${long}`;
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Whether the last train leaves after midnight, so its time belongs to the next morning. */
function endsAfterMidnight({ from, to }: LineServicePeriod): boolean {
  if (to === null) return false;
  // Service carried on from the night before starts at midnight, so a morning time is the next one.
  return from === null ? toMinutes(to) < 12 * 60 : to <= from;
}

export type ServiceStatus =
  | { running: true; period: LineServicePeriod; lastTrain: string | null }
  | { running: false; opens: { time: string; day: string | null } | null };

/** The period running each weekday, Monday first. */
function byWeekday(service: readonly LineServicePeriod[]): (LineServicePeriod | undefined)[] {
  const days: (LineServicePeriod | undefined)[] = Array.from({ length: 7 });
  for (const period of service) for (const day of dayIndexes(period.days)) days[day] = period;
  return days;
}

/** Index of the weekday and minutes since midnight at the line's clock. */
function localTime(now: Date, country: CountryCode): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONES[country],
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    day: DAY_NAMES.indexOf(part("weekday") as (typeof DAY_NAMES)[number]),
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/** Whether trains run now on the line's clock, and if not, when the next one leaves. */
export function getServiceStatus(
  service: readonly LineServicePeriod[],
  country: CountryCode,
  now: Date,
): ServiceStatus {
  const { day, minutes } = localTime(now, country);
  const days = byWeekday(service);
  const today = days[day];
  const yesterday = days[(day + 6) % 7];

  // Last night's service still running into this morning.
  if (yesterday?.to && endsAfterMidnight(yesterday) && minutes < toMinutes(yesterday.to)) {
    return { running: true, period: yesterday, lastTrain: yesterday.to };
  }
  if (today) {
    const start = today.from === null ? 0 : toMinutes(today.from);
    const end =
      today.to === null ? Infinity : toMinutes(today.to) + (endsAfterMidnight(today) ? 24 * 60 : 0);
    if (minutes >= start && minutes < end) {
      return { running: true, period: today, lastTrain: today.to };
    }
    if (today.from !== null && minutes < start) {
      return { running: false, opens: { time: today.from, day: null } };
    }
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = days[(day + ahead) % 7];
    if (next?.from) {
      const name = ahead === 1 ? "tomorrow" : DAY_NAMES[(day + ahead) % 7]!;
      return { running: false, opens: { time: next.from, day: name } };
    }
  }
  return { running: false, opens: null };
}

/** Index of the period for today on the line's clock, or -1 on a day without trains. */
export function getTodayPeriodIndex(
  service: readonly LineServicePeriod[],
  country: CountryCode,
  now: Date,
): number {
  const { day } = localTime(now, country);
  return service.findIndex((period) => dayIndexes(period.days).includes(day));
}

/** "Running" with "last train 00:40", or "Closed" with "opens tomorrow 05:30". */
export function formatStatus(status: ServiceStatus): { label: string; detail: string | null } {
  if (status.running) {
    const { lastTrain, period } = status;
    const detail =
      lastTrain !== null
        ? `last train ${lastTrain}`
        : period.from === null
          ? "24 hours"
          : "all night";
    return { label: "Running", detail };
  }
  if (!status.opens) return { label: "No service", detail: null };
  const { day, time } = status.opens;
  return { label: "Closed", detail: `opens ${day ? `${day} ` : ""}${time}` };
}

/** Country of a line, from its ID's prefix (checked when the catalog loads). */
export function getLineCountry(lineId: string): CountryCode {
  return lineId.split("-")[0] as CountryCode;
}

/**
 * The time, refreshed each minute once mounted. Null while rendering on the server and
 * hydrating, so prerendered pages don't bake in the build's clock.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
