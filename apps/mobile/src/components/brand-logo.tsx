import { useEffect, useState } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

import { getBrandLogoUrl } from "@/lib/brands";

// Every row of a board shows the same few logos, so each one is downloaded once per launch.
const logos = new Map<string, Promise<string | null>>();

function loadLogo(url: string) {
  let logo = logos.get(url);
  if (!logo) {
    logo = fetch(url)
      .then((response) => (response.ok ? response.text() : null))
      .catch(() => {
        logos.delete(url);
        return null;
      });
    logos.set(url, logo);
  }
  return logo;
}

/** The train operator's logo, from the web app. Nothing when the brand has none. */
export function BrandLogo({ brand, size = 16 }: { brand: string | null; size?: number }) {
  const url = brand ? getBrandLogoUrl(brand) : null;
  const [logo, setLogo] = useState<{ url: string; xml: string } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void loadLogo(url).then((xml) => {
      if (!cancelled && xml) setLogo({ url, xml });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  // The space is kept while the logo loads, so the row doesn't shift when it appears.
  return (
    <View
      accessibilityLabel={brand ?? undefined}
      style={{ width: size, height: size, borderRadius: 4, overflow: "hidden" }}
    >
      {logo?.url === url ? <SvgXml xml={logo.xml} width={size} height={size} /> : null}
    </View>
  );
}
