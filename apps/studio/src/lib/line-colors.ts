import type { Line } from "@repo/data";
import { DEFAULT_LINE_COLOR } from "@repo/data/lines";

export { DEFAULT_LINE_COLOR };

export function getLineColor(line: Pick<Line, "color">): string {
  return line.color ?? DEFAULT_LINE_COLOR;
}

/** Short public codes (M1, A, T1) fit a badge; longer ones read better as plain names. */
export function getLineBadgeCode(line: Pick<Line, "code">): string | null {
  return line.code && line.code.length <= 4 ? line.code : null;
}

/** Pick dark or light text for a #RRGGBB line color. */
export function getLineTextColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const brightness = (r! * 299 + g! * 587 + b! * 114) / 1000;
  return brightness >= 150 ? "#18181b" : "#ffffff";
}
