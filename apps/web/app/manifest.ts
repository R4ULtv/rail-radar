import { MetadataRoute } from "next";
import { staticAssetUrl } from "@/lib/static-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rail Radar - Live Train Tracker Across Europe",
    short_name: "Rail Radar",
    description:
      "Track trains in real time across 18,000+ stations in 12 European countries, including Poland, Denmark, and Germany. Get live delays, platform numbers, and departure info on an interactive map.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    orientation: "portrait",
    lang: "en-US",
    dir: "ltr",
    categories: ["travel", "utilities", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon@192px.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon@192px.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon@512px.png",
        sizes: "512x512",
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
        src: staticAssetUrl("/screenshots/mobile-home.png"),
        sizes: "828x1792",
        type: "image/png",
        form_factor: "narrow",
        label: "Mobile map view showing nearby stations and live train activity",
      },
      {
        src: staticAssetUrl("/screenshots/mobile-detail.png"),
        sizes: "828x1792",
        type: "image/png",
        form_factor: "narrow",
        label: "Mobile station detail view with live departures, platforms, and delays",
      },
      {
        src: staticAssetUrl("/screenshots/desktop-home.png"),
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "Desktop map view for exploring stations across Europe",
      },
      {
        src: staticAssetUrl("/screenshots/desktop-detail.png"),
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "Desktop station detail view with live departures, platforms, and delays",
      },
    ],
  };
}
