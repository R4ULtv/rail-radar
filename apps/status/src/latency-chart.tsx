import type { LatencyDay } from "@repo/data/status";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@repo/ui/components/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { dayLabel, integer, milliseconds } from "./format";
import { LATENCY_SERIES, type LatencyKey } from "./latency-series";

const config = {
  p50: { label: "p50", color: "var(--latency-p50)" },
  p90: { label: "p90", color: "var(--latency-p90)" },
  p99: { label: "p99", color: "var(--latency-p99)" },
} satisfies ChartConfig;

const KEYS = LATENCY_SERIES.map((series) => series.key);

/** Log-scale bounds on the 1-3-10 steps around every value, so timeouts don't flatten p50. */
export function logAxis(values: number[]) {
  const positive = values.map((value) => Math.max(value, 1));
  const min = Math.min(...positive, 1e9);
  const max = Math.max(...positive, 1);
  const steps: number[] = [];
  for (let decade = 1; decade <= Math.max(max, 1) * 10; decade *= 10)
    steps.push(decade, decade * 3);
  const low = steps.findLast((step) => step <= min) ?? 1;
  const top = steps.find((step) => step >= max)!;
  const high = top > low ? top : steps[steps.indexOf(top) + 1]!;
  return {
    domain: [low, high] as [number, number],
    ticks: steps.filter((step) => step >= low && step <= high),
  };
}

/** Missing fields (a response cached before a percentile was added) read as no data. */
const percentile = (day: LatencyDay, key: LatencyKey) => day.latency[key] ?? null;

const tickLabel = (value: number) =>
  value >= 1000 ? `${integer.format(value / 1000)}k` : integer.format(value);

export default function LatencyChart({
  days,
  name,
  focused = null,
}: {
  days: LatencyDay[];
  name: string;
  /** Series picked in the legend; the others fade back. */
  focused?: LatencyKey | null;
}) {
  // A log axis can't place 0 ms; plot it at 1 ms. The tooltip still reads the exact values.
  const data = days.map((day) => ({
    date: day.date,
    ...Object.fromEntries(
      KEYS.map((key) => {
        const value = percentile(day, key);
        return [key, value === null ? null : Math.max(value, 1)];
      }),
    ),
  }));
  const axis = logAxis(
    days
      .flatMap((day) => KEYS.map((key) => percentile(day, key)))
      .filter((value) => value !== null),
  );
  return (
    <ChartContainer
      config={config}
      className="latency-chart"
      aria-label={`${name}: daily p50, p90, and p99 response times in milliseconds, on a log scale`}
    >
      <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          minTickGap={55}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          width={40}
          type="number"
          scale="log"
          domain={axis.domain}
          ticks={axis.ticks}
          interval={0}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickLabel}
        />
        <ChartTooltip
          content={({ active, payload }: TooltipContentProps) => {
            const date = payload?.[0]?.payload?.date as string | undefined;
            const day = days.find((item) => item.date === date);
            if (!active || !day) return null;
            return (
              <div className="latency-tooltip" data-focused={focused ?? undefined}>
                <strong>
                  {dayLabel(day.date)}
                  {day.partial ? " · partial day" : ""}
                </strong>
                {KEYS.map((key) => (
                  <span key={key} className="tooltip-value" data-series={key}>
                    <span>{config[key].label}</span>
                    <b>{milliseconds(percentile(day, key))}</b>
                  </span>
                ))}
                <small>{integer.format(day.latencySamples)} timed observations</small>
              </div>
            );
          }}
        />
        {/* Tail first, median on top. A focused series stands out by fading the others; don't
            swap zIndex for it: Recharts 3.8 drops a line that moves into a layer another
            line is leaving in the same render. */}
        {(["p99", "p90", "p50"] as const).map((key) => {
          const faded = focused !== null && focused !== key;
          return (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={config[key].label}
              stroke={`var(--color-${key})`}
              strokeOpacity={faded ? 0.15 : 1}
              strokeWidth={focused === key ? 2.5 : key === "p50" ? 2 : 1.5}
              // Small dots in the line's own color keep a lone day between gaps visible.
              dot={faded ? false : { r: 1.5, strokeWidth: 0, fill: `var(--color-${key})` }}
              activeDot={faded ? false : { r: 3.5, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ChartContainer>
  );
}
