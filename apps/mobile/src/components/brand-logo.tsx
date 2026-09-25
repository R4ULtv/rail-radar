import { View } from "react-native";

import { getBrandLogo } from "@/lib/brands";

/** The train operator's logo, bundled from the web app. Nothing when the brand has none. */
export function BrandLogo({ brand, size = 16 }: { brand: string | null; size?: number }) {
  const Logo = brand ? getBrandLogo(brand) : null;
  if (!Logo) return null;

  return (
    <View
      accessibilityLabel={brand ?? undefined}
      style={{ width: size, height: size, borderRadius: 4, overflow: "hidden" }}
    >
      <Logo width={size} height={size} />
    </View>
  );
}
