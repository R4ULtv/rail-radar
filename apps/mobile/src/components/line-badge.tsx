import { Text, View } from "react-native";

import { getLineBadgeCode, getLineColor, getLineTextColor, type Line } from "@/lib/lines";

// Mirrors apps/web/src/components/line-badge.tsx. `icon` fills the place of a station's icon in
// lists. With no code to show, the small ones are a narrow
// bar of the color, so a row of them takes little room.
const sizes = {
  xs: {
    box: "h-4 min-w-5 rounded-[5px] px-1",
    bar: "h-4 w-2 rounded-[3px]",
    text: "text-[10px]",
  },
  sm: { box: "h-5 min-w-7 rounded-md px-1.5", bar: "h-5 w-3 rounded-[4px]", text: "text-[11px]" },
  // As wide as a station's icon, so the names of lines and stations line up in lists. Longer codes
  // shrink to fit instead.
  icon: { box: "size-6 rounded-md px-0.5", bar: "size-6 rounded-md", text: "text-xs" },
  lg: { box: "h-10 min-w-10 rounded-xl px-2", bar: "size-10 rounded-xl", text: "text-base" },
};

/** The line's public code on its color; lines without a short code are just the color. */
export function LineBadge({
  line,
  size = "sm",
}: {
  line: Pick<Line, "code" | "name" | "color">;
  size?: keyof typeof sizes;
}) {
  const code = getLineBadgeCode(line);
  const color = getLineColor(line);
  const { box, bar, text } = sizes[size];

  return (
    <View
      accessible
      accessibilityLabel={line.name}
      className={`shrink-0 items-center justify-center ${code ? box : bar}`}
      style={{ backgroundColor: color }}
    >
      {code ? (
        <Text
          className={`font-semibold ${text}`}
          style={{ color: getLineTextColor(color), fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
          adjustsFontSizeToFit={size === "icon"}
          minimumFontScale={0.6}
          maxFontSizeMultiplier={size === "icon" ? 1 : 1.4}
        >
          {code}
        </Text>
      ) : null}
    </View>
  );
}
