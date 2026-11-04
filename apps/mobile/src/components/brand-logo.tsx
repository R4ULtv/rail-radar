import { Text, View } from "react-native";

import { getBrandLogo } from "@/lib/brands";

/** Bundled logo, or the API's brand name when this app version has no artwork for it. */
export function BrandLogo({ brand, size = 16 }: { brand: string | null; size?: number }) {
  if (!brand?.trim()) return null;
  const Logo = getBrandLogo(brand);
  if (!Logo) {
    return (
      <Text className="shrink text-xs text-muted" numberOfLines={1} style={{ maxWidth: 96 }}>
        {brand.trim()}
      </Text>
    );
  }

  return (
    <View
      accessibilityLabel={brand ?? undefined}
      style={{ width: size, height: size, borderRadius: 4, overflow: "hidden" }}
    >
      <Logo width={size} height={size} />
    </View>
  );
}
