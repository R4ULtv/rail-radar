import Mapbox from "@rnmapbox/maps";

// The web map's location marker as images, rendered by
// `pnpm --filter=mobile generate:location-puck`.
const puckImages = {
  "location-dot": require("../../assets/location-puck/location-dot.png"),
  "location-halo": require("../../assets/location-puck/location-halo.png"),
  "location-empty": require("../../assets/location-puck/location-empty.png"),
};

/**
 * The web map's location marker: an accent dot with a white ring, a soft halo and a ping.
 * It's the map's own puck, so it moves with the map instead of trailing behind it.
 */
export function UserLocationMarker() {
  return (
    <>
      <Mapbox.Images images={puckImages} />
      <Mapbox.LocationPuck
        topImage="location-dot"
        bearingImage="location-empty"
        shadowImage="location-halo"
        // Like the web's animate-ping: a 20pt accent ring growing to twice its size.
        pulsing={{ isEnabled: true, color: "rgba(99, 99, 255, 0.4)", radius: 20 }}
      />
    </>
  );
}
