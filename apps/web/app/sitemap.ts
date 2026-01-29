import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.railradar24.com";

  // Homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const stationRoutes: MetadataRoute.Sitemap = [
    2416, // Roma Termini
    2385, // Roma Tiburtina
    2379, // Roma Ostiense
    1728, // Milano Centrale
    1720, // Milano Rogoredo
    1888, // Napoli Centrale
    4020, // Napoli Afragola
    683, // Bologna Centrale
    1325, // Firenze Santa Maria Novella
    2876, // Torino Porta Nuova
    2855, // Torino Lingotto
    3009, // Venezia S.Lucia
    3025, // Verona Porta Nuova
    245, // Genova Brignole
    257, // Genova Piazza Principe
    595, // Bari Centrale
    2018, // Palermo Centrale
    1032, // Catania Centrale
    1700, // Messina Centrale
    2156, // Pisa Centrale
    275, // La Spezia Centrale
    2925, // Trieste Centrale
    2922, // Treviso Centrale
  ].map((station) => ({
    url: `${baseUrl}/station/${station}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...routes, ...stationRoutes];
}
