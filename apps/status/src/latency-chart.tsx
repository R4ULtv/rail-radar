import type { LatencyDay } from "@repo/data/status";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@repo/ui/components/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { dayLabel, integer, milliseconds } from "./format";

const config = {
  p50: { label: "p50", color: "var(--latency-median)" },
  p99: { label: "p99", color: "var(--latency-tail)" },
  p999: { label: "p99.9", color: "var(--latency-extreme)" },
} satisfies ChartConfig;

const KEYS = ["p50", "p99", "p999"] as const;

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

const tickLabel = (value: number) =>
  value >= 1000 ? `${integer.format(value / 1000)}k` : integer.format(value);

export default function LatencyChart({ days, name }: { days: LatencyDay[]; name: string }) {
  // A log axis can't place 0 ms; plot it at 1 ms. The tooltip still reads the exact values.
  const data = days.map((day) => ({
    date: day.date,
    ...Object.fromEntries(
      KEYS.map((key) => [key, day.latency[key] === null ? null : Math.max(day.latency[key], 1)]),
    ),
  }));
  const axis = logAxis(
    days.flatMap((day) => KEYS.map((key) => day.latency[key])).filter((value) => value !== null),
  );
  return (
    <ChartContainer
      config={config}
      className="latency-chart"
      aria-label={`${name}: daily p50, p99, and p99.9 response times in milliseconds, on a log scale`}
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
          content={({ active, payload }) => {
            const date = payload?.[0]?.payload?.date as string | undefined;
            const day = days.find((item) => item.date === date);
            if (!active || !day) return null;
            return (
              <div className="latency-tooltip">
                <strong>
                  {dayLabel(day.date)}
                  {day.partial ? " · partial day" : ""}
                </strong>
                {KEYS.map((key) => (
                  <span key={key} className="tooltip-value">
                    <span>{config[key].label}</span>
                    <b>{milliseconds(day.latency[key])}</b>
                  </span>
                ))}
                <small>{integer.format(day.latencySamples)} timed observations</small>
              </div>
            );
          }}
        />
        {/* p99.9 is dashed and drawn over p99: on small samples the two are often equal. */}
        {(["p99", "p999", "p50"] as const).map((key) => (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            name={config[key].label}
            stroke={`var(--color-${key})`}
            strokeWidth={key === "p50" ? 2 : 1.5}
            strokeDasharray={key === "p999" ? "4 4" : undefined}
            // Small dots in the line's own color keep a lone day between gaps visible.
            dot={key === "p999" ? false : { r: 1.5, strokeWidth: 0, fill: `var(--color-${key})` }}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
