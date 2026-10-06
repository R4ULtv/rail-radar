import Mapbox from "@rnmapbox/maps";
import { memo, useEffect, useState } from "react";
import { Easing } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useDeviceHeading } from "@/hooks/use-device-heading";
import type { UserLocation } from "@/lib/user-location";

// The web map's location marker as images, rendered by
// `pnpm --filter=mobile generate:location-puck`.
const puckImages = {
  "location-bearing": require("../../assets/location-puck/location-bearing.png"),
  "location-dot": require("../../assets/location-puck/location-dot.png"),
  "location-halo": require("../../assets/location-puck/location-halo.png"),
};

/**
 * Native map layers use only our scheduled fixes, without starting Mapbox's own GPS tracker.
 * Animation is local to this source: search and the map screen do not re-render on each frame.
 */
export const UserLocationMarker = memo(function UserLocationMarker({
  location,
  showHeading,
}: {
  location: UserLocation;
  showHeading: boolean;
}) {
  const { bearing, isAvailable } = useDeviceHeading(showHeading);
  const reduceMotion = useReducedMotion();
  const [point] = useState(
    () =>
      new Mapbox.AnimatedPoint({
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      }),
  );

  useEffect(() => {
    point.stopAnimation(undefined);
    const timing = {
      coordinates: [location.longitude, location.latitude],
      duration: reduceMotion ? 0 : 700,
      easing: Easing.linear,
    };
    point.timing(timing).start();
    return () => point.stopAnimation(undefined);
  }, [point, location, reduceMotion]);

  return (
    <>
      <Mapbox.Images images={puckImages} />
      <Mapbox.Animated.ShapeSource id="user-location" shape={point}>
        <Mapbox.Animated.SymbolLayer
          id="user-location-bearing"
          style={{
            iconImage: "location-bearing",
            iconSize: 1,
            iconRotate: bearing,
            iconRotationAlignment: "map",
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconEmissiveStrength: 1,
            iconOpacity: isAvailable ? 1 : 0,
            iconOpacityTransition: { duration: 0, delay: 0 },
          }}
        />
        <Mapbox.SymbolLayer
          id="user-location-halo"
          style={{
            iconImage: "location-halo",
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconEmissiveStrength: 1,
          }}
        />
        <Mapbox.SymbolLayer
          id="user-location-dot"
          style={{
            iconImage: "location-dot",
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconEmissiveStrength: 1,
          }}
        />
      </Mapbox.Animated.ShapeSource>
    </>
  );
});
