import type { CountryCode } from "@repo/data/countries";
import type { LineServicePeriod, Weekday } from "@repo/data/types";

const dayNames: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** "Mon–Fri", or a single day in full, "Saturday", as the timetable in About lists them. */
export function formatServiceDays(days: LineServicePeriod["days"]): string {
  if (days === "mon-sun") return "Every day";
  const [first, last] = days.split("-") as [Weekday, Weekday?];
  if (!last) return dayNames[first];
  const short = (day: Weekday) => shortDayNames[weekdays.indexOf(day)];
  return `${short(first)}–${short(last)}`;
}

/** "05:40 – 00:37", or how a service that runs through the night starts or ends. */
export function formatServiceHours({ from, to }: Pick<LineServicePeriod, "from" | "to">): string {
  if (from === null && to === null) return "24 hours";
  if (from === null) return `Until ${to}`;
  if (to === null) return `From ${from}, all night`;
  return `${from} – ${to}`;
}

/** "2–8 min" between trains. */
export function formatServiceFrequency([shortest, longest]: LineServicePeriod["every"]): string {
  return shortest === longest ? `${shortest} min` : `${shortest}–${longest} min`;
}

/** Service times are local to the line, whatever the phone's clock says. */
const timeZones: Record<CountryCode, string> = {
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

const weekdays: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const shortDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Formatters are slow to build on the device's JS engine, so each zone gets one.
const clockFormats = new Map<string, Intl.DateTimeFormat>();

/** Weekday (Monday 0) and minutes since midnight on the line's clock. */
function localTime(now: Date, country: CountryCode): { day: number; minutes: number } {
  const timeZone = timeZones[country];
  let format = clockFormats.get(timeZone);
  if (!format) {
    // "Mon 05:30". Plain format() rather than formatToParts, which Hermes lacks on some builds.
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    clockFormats.set(timeZone, format);
  }
  const match = /([A-Za-z]{3})\D*(\d{1,2}):(\d{2})/.exec(format.format(now));
  if (!match) throw new Error(`Unreadable time for ${timeZone}`);
  return {
    day: shortDayNames.indexOf(match[1]!),
    // Some engines write midnight as 24:00.
    minutes: (Number(match[2]) % 24) * 60 + Number(match[3]),
  };
}

function dayIndexes(days: LineServicePeriod["days"]): number[] {
  const [first, last = first] = days.split("-") as [Weekday, Weekday?];
  const start = weekdays.indexOf(first);
  return Array.from({ length: weekdays.indexOf(last) - start + 1 }, (_, offset) => start + offset);
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Whether the last departure is after midnight, so its time is the next morning's. */
function endsAfterMidnight({ from, to }: LineServicePeriod): boolean {
  if (to === null) return false;
  // Service carried on from the night before starts at midnight, so a morning time is the next one.
  return from === null ? toMinutes(to) < 12 * 60 : to <= from;
}

/** The period for today on the line's clock, to pick it out in the timetable. */
export function getTodaysPeriod(
  service: readonly LineServicePeriod[],
  country: CountryCode,
  now: Date,
): LineServicePeriod | undefined {
  const { day } = localTime(now, country);
  return service.find((period) => dayIndexes(period.days).includes(day));
}

export type ServiceStatus =
  | { running: true; period: LineServicePeriod; lastDeparture: string | null }
  | { running: false; opens: { time: string; day: string | null } | null };

/** Whether trains run now on the line's clock, and if not, when the first one leaves. */
export function getServiceStatus(
  service: readonly LineServicePeriod[],
  country: CountryCode,
  now: Date,
): ServiceStatus {
  const { day, minutes } = localTime(now, country);
  const byDay: (LineServicePeriod | undefined)[] = Array.from({ length: 7 });
  for (const period of service) for (const index of dayIndexes(period.days)) byDay[index] = period;
  const today = byDay[day];
  const yesterday = byDay[(day + 6) % 7];

  // Last night's service still running into this morning.
  if (yesterday?.to && endsAfterMidnight(yesterday) && minutes < toMinutes(yesterday.to)) {
    return { running: true, period: yesterday, lastDeparture: yesterday.to };
  }
  if (today) {
    const start = today.from === null ? 0 : toMinutes(today.from);
    const end =
      today.to === null ? Infinity : toMinutes(today.to) + (endsAfterMidnight(today) ? 1440 : 0);
    if (minutes >= start && minutes < end) {
      return { running: true, period: today, lastDeparture: today.to };
    }
    if (today.from !== null && minutes < start) {
      return { running: false, opens: { time: today.from, day: null } };
    }
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = byDay[(day + ahead) % 7];
    if (next?.from) {
      const name = ahead === 1 ? "tomorrow" : dayNames[weekdays[(day + ahead) % 7]!];
      return { running: false, opens: { time: next.from, day: name } };
    }
  }
  return { running: false, opens: null };
}

/** "Running" with "every 2–5 min · until 00:40", or "Closed" with "opens tomorrow 05:30". */
export function formatServiceStatus(status: ServiceStatus): {
  label: string;
  detail: string | null;
} {
  if (status.running) {
    const { lastDeparture, period } = status;
    const until =
      lastDeparture !== null
        ? `until ${lastDeparture}`
        : period.from === null
          ? "24 hours"
          : "all night";
    return { label: "Running", detail: `every ${formatServiceFrequency(period.every)} · ${until}` };
  }
  if (!status.opens) return { label: "No service", detail: null };
  const { day, time } = status.opens;
  return { label: "Closed", detail: `opens ${day ? `${day} ` : ""}${time}` };
}
