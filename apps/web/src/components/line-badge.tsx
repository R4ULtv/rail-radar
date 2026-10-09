import type { Line } from "@repo/data";
import { cn } from "@repo/ui/lib/utils";
import { getLineBadgeCode, getLineTextColor } from "@/lib/line-colors";

type BadgeLine = Pick<Line, "code" | "name" | "type"> & { color: string };

const sizes = {
  sm: "h-5 min-w-7 rounded-md px-1.5 text-[11px]",
  md: "h-7 min-w-9 rounded-lg px-2 text-[13px]",
  xl: "size-16 rounded-3xl text-2xl",
};

/** The line's public code on its color; lines without one get their mode's glyph. */
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
      {code ?? <LineGlyph type={line.type} size={size} />}
      <span className="sr-only">{code ? ` ${line.name}` : line.name}</span>
    </span>
  );
}

/** The glyphs of the map's metro and light rail markers. */
function LineGlyph({ type, size }: { type: Line["type"]; size: keyof typeof sizes }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      // Always white, like the glyphs on the map's markers, whatever the line color.
      className={cn(
        "text-white",
        type === "metro" ? "size-5" : "size-3.5",
        size === "md" && (type === "metro" ? "size-6" : "size-4.5"),
        size === "xl" && (type === "metro" ? "size-14" : "size-9"),
      )}
    >
      {type === "metro" ? (
        <path d="M8 16V8.5a.5.5 0 0 1 .9-.3l2.7 3.599a.5.5 0 0 0 .8 0l2.7-3.6a.5.5 0 0 1 .9.3V16" />
      ) : (
        <>
          <rect width="16" height="16" x="4" y="3" rx="2" />
          <path d="M4 11h16M12 3v8m-4 11 2-3m8 3-2-3M8 15h.01M16 15h.01" />
        </>
      )}
    </svg>
  );
}
