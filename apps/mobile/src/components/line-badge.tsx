import { Text, View } from "react-native";

import { getLineBadgeCode, getLineColor, getLineTextColor, type Line } from "@/lib/lines";

// Mirrors apps/web/src/components/line-badge.tsx. `icon` fills the place of a station's icon in
// lists, and `lg` leads the line sheet's title.
const sizes = {
  xs: { box: "h-4 min-w-5 rounded-[5px] px-1", text: "text-[10px]" },
  sm: { box: "h-5 min-w-7 rounded-md px-1.5", text: "text-[11px]" },
  // As wide as a station's icon, so the names of lines and stations line up in lists. Longer codes
  // shrink to fit instead.
  icon: { box: "size-6 rounded-md px-0.5", text: "text-xs" },
  lg: { box: "h-10 min-w-10 rounded-xl px-2", text: "text-base" },
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
  const { box, text } = sizes[size];

  return (
    <View
      accessible
      accessibilityLabel={line.name}
      className={`shrink-0 items-center justify-center ${box}`}
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
