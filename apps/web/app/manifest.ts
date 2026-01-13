import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rail Radar - Live Train Tracker for Italy",
    short_name: "Rail Radar",
    description:
      "Track Italian trains in real time. Get live delays, platform numbers, and departure info for all train stations across Italy.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    icons: [
      {
        src: "/icon@192px.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon@512px.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
