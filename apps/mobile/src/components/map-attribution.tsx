import { Fragment } from "react";
import { Linking, Text } from "react-native";

import { mapboxUrl, openStreetMapUrl } from "@/lib/links";

/** The map credits Mapbox's terms require, shown in the sheets instead of on the map. */
export function MapAttribution({
  className,
  getMapFeedbackUrl,
}: {
  className?: string;
  /** "Improve this map" for where the map is now. */
  getMapFeedbackUrl: () => string;
}) {
  const links = [
    { label: "© Mapbox", url: () => mapboxUrl },
    { label: "© OpenStreetMap", url: () => openStreetMapUrl },
    { label: "Improve this map", url: getMapFeedbackUrl },
  ];

  return (
    <Text className={`text-center text-xs text-muted ${className ?? ""}`}>
      {links.map((link, index) => (
        <Fragment key={link.label}>
          {index > 0 ? ", " : null}
          <Text accessibilityRole="link" onPress={() => void Linking.openURL(link.url())}>
            {link.label}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
}
