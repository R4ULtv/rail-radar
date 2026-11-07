import type { ProviderDay } from "@repo/data/status";
import { useRef, useState, type PointerEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { dayLabel, integer, percent, STATUS_LABELS } from "./format";

type HistoryDay = Pick<
  ProviderDay,
  "date" | "partial" | "status" | "requests" | "successRate" | "samples"
>;

export function ProviderHistory({
  days,
  name,
  successLabel = "successful",
}: {
  days: HistoryDay[];
  name: string;
  successLabel?: string;
}) {
  const [selected, setSelected] = useState<HistoryDay>();
  const [activeIndex, setActiveIndex] = useState(days.length - 1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Day bars are ~8px wide on phones, so touch and pen pick the day under the finger and
  // follow a horizontal drag across the whole strip, including the gaps between bars.
  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || (event.type === "pointermove" && event.buttons === 0)) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * days.length);
    const clamped = Math.min(days.length - 1, Math.max(0, index));
    setSelected(days[clamped]);
    setActiveIndex(clamped);
  };
  const detail = (day: HistoryDay) =>
    `${dayLabel(day.date)}${day.partial ? " · so far today" : ""}: ${STATUS_LABELS[day.status]}. ${integer.format(day.requests)} requests · ${percent(day.successRate)} ${successLabel} · ${integer.format(day.samples)} observations.`;

  return (
    <div className="history">
      <div
        className="history-bars"
        role="toolbar"
        aria-label={`${name}: daily status. Use arrow keys to move between days; select a day for details.`}
        onPointerDown={scrub}
        onPointerMove={scrub}
      >
        {days.map((day, index) => (
          <Tooltip key={day.date}>
            <TooltipTrigger
              className="history-day"
              data-health={day.status}
              data-partial={day.partial || undefined}
              aria-label={detail(day)}
              aria-pressed={selected?.date === day.date}
              ref={(button) => {
                buttons.current[index] = button;
              }}
              tabIndex={index === activeIndex ? 0 : -1}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setSelected(day)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSelected(undefined);
                const next =
                  event.key === "ArrowRight"
                    ? Math.min(index + 1, days.length - 1)
                    : event.key === "ArrowLeft"
                      ? Math.max(index - 1, 0)
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? days.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  buttons.current[next]?.focus();
                }
              }}
            />
            <TooltipContent>{detail(day)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="history-axis">
        <span>{days[0] ? dayLabel(days[0].date) : ""}</span>
        <span>Today · UTC</span>
      </div>
      {selected && (
        <p className="history-detail" role="status">
          {detail(selected)}
        </p>
      )}
    </div>
  );
}
