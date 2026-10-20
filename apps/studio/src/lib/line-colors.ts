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

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#18181b";

/** WCAG 2 relative luminance of a #RRGGBB color. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * White on a line color unless it falls below `minContrast` and dark text reaches it. Mid
 * tones like Milano M1's red pass with neither, and keep the white their signs use.
 */
function pickForeground(color: string, minContrast: number): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return LIGHT_TEXT;
  return contrast(color, LIGHT_TEXT) < minContrast && contrast(color, DARK_TEXT) >= minContrast
    ? DARK_TEXT
    : LIGHT_TEXT;
}

/** Text on a line color, held to WCAG AA for normal text (4.5:1). */
export function getLineTextColor(color: string): string {
  return pickForeground(color, 4.5);
}
