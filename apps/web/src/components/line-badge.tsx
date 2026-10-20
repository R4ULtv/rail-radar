import type { Line } from "@repo/data";
import { cn } from "@repo/ui/lib/utils";
import { getLineBadgeCode, getLineTextColor } from "@/lib/line-colors";

type BadgeLine = Pick<Line, "code" | "name"> & { color: string };

const sizes = {
  xs: "h-4 min-w-5 rounded-[5px] px-1 text-[10px]",
  sm: "h-5 min-w-7 rounded-md px-1.5 text-[11px]",
  md: "h-7 min-w-9 rounded-lg px-2 text-[13px]",
  xl: "size-16 rounded-3xl text-2xl",
};

/** The line's public code on its color; lines without a short code are just the color. */
export function LineBadge({
  line,
  size = "sm",
  className,
}: {
  line: BadgeLine;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const code = getLineBadgeCode(line);

  return (
    <span
      title={line.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold leading-none tracking-tight tabular-nums",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: line.color, color: getLineTextColor(line.color) }}
    >
      {code}
      <span className="sr-only">{code ? ` ${line.name}` : line.name}</span>
    </span>
  );
}
