import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rail Radar - Live Train Tracker for Italy",
    short_name: "Rail Radar",
    description:
      "Track Italian trains in real time. Get live delays, platform numbers, and departure info for all train stations across Italy.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    orientation: "portrait",
    lang: "en-US",
    dir: "ltr",
    categories: ["travel", "utilities", "productivity"],
    icons: [
      {
        src: "/icon@192px.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon@512px.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/mobile-home.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Home Screen showing live trains",
      },
      {
        src: "/screenshots/mobile-detail.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Train Details and Delays",
      },
    ],
  };
}
