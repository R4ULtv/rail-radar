import type { CountryCode } from "./countries";

export type ServiceType =
  | "high-speed"
  | "intercity"
  | "regional"
  | "commuter"
  | "night-train"
  | "international"
  | "scenic";

export interface BrandLink {
  label: string;
  url: string;
  type: "website" | "timetables" | "api" | "wikipedia";
}

/** [west, south, east, north] longitude/latitude bounding box */
export type BrandBounds = [number, number, number, number];

export interface Brand {
  slug: string;
  name: string;
  logoPath: string;
  countries: CountryCode[];
  bounds: BrandBounds;
  description: string;
  website: string;
  founded: number | null;
  headquarters: string | null;
  networkKm: number | null;
  annualPassengers: number | null;
  serviceTypes: ServiceType[];
  parentCompany: string | null;
  links: BrandLink[];
}

export const brands: Brand[] = [
  // Italian brands
  {
    slug: "trenitalia",
    name: "Trenitalia",
    logoPath: "it/trenitalia",
    countries: ["it"],
    bounds: [6.6, 36.6, 18.5, 47.1],
    description:
      "Trenitalia, the primary passenger railway operator in Italy and a subsidiary of the FS Group, manages a vast network of regional, intercity, and high-speed services. Operating under public service contracts for local transport and in the open market for high-speed rail, it provides critical mobility across the entire Italian peninsula.",
    website: "https://www.trenitalia.com",
    founded: 2000,
    headquarters: "Rome, Italy",
    networkKm: 16829,
    annualPassengers: 500_000_000,
    serviceTypes: ["high-speed", "intercity", "regional", "commuter"],
    parentCompany: "Ferrovie dello Stato Italiane",
    links: [
      { label: "Official Site", url: "https://www.trenitalia.com", type: "website" },
      {
        label: "Timetables",
        url: "https://www.trenitalia.com/en.html",
        type: "timetables",
      },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Trenitalia", type: "wikipedia" },
    ],
  },
  {
    slug: "italo",
    name: "Italo",
    logoPath: "it/italo",
    countries: ["it"],
    bounds: [9.0, 40.5, 16.5, 46.0],
    description:
      "Operated by Italo-NTV, this is Italy's first private high-speed rail service. Competing directly on the state-owned RFI high-speed network, Italo operates a modern fleet of Alstom AGV and Pendolino EVO trains, connecting major Italian cities with a focus on a premium passenger experience and high-frequency schedules.",
    website: "https://www.italotreno.it",
    founded: 2006,
    headquarters: "Rome, Italy",
    networkKm: 1400,
    annualPassengers: 22_000_000,
    serviceTypes: ["high-speed"],
    parentCompany: "Italo – Nuovo Trasporto Viaggiatori",
    links: [
      { label: "Official Site", url: "https://www.italotreno.com", type: "website" },
      {
        label: "Timetables",
        url: "https://www.italotreno.com/en/train-timetable",
        type: "timetables",
      },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Italo_Nuovo_Trasporto_Viaggiatori",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "frecciarossa",
    name: "Frecciarossa",
    logoPath: "it/frecciarossa",
    countries: ["it"],
    bounds: [7.5, 40.5, 16.5, 46.0],
    description:
      "Frecciarossa is Trenitalia's premier high-speed service, reaching operational speeds of 300 km/h. Utilizing advanced trainsets like the ETR 500 and ETR 1000, it forms the rapid transit backbone of Italy along the Turin-Salerno and Milan-Venice corridors, while also expanding its reach into international markets like France and Spain.",
    website: "https://www.trenitalia.com",
    founded: 2008,
    headquarters: "Rome, Italy",
    networkKm: 1000,
    annualPassengers: 70_000_000,
    serviceTypes: ["high-speed"],
    parentCompany: "Trenitalia",
    links: [
      { label: "Official Site", url: "https://www.trenitalia.com", type: "website" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Frecciarossa", type: "wikipedia" },
    ],
  },
  {
    slug: "intercity",
    name: "Intercity",
    logoPath: "it/intercity",
    countries: ["it"],
    bounds: [6.6, 36.6, 18.5, 47.1],
    description:
      "Trenitalia's Intercity network connects medium and large Italian cities not served by the Alta Velocità high-speed lines. Subsidized as a Public Service Obligation (PSO), it ensures territorial continuity across the country, including unique operations like train ferries across the Strait of Messina to reach Sicily.",
    website: "https://www.trenitalia.com",
    founded: 1980,
    headquarters: "Rome, Italy",
    networkKm: 16832,
    annualPassengers: 15_000_000,
    serviceTypes: ["intercity"],
    parentCompany: "Trenitalia",
    links: [
      { label: "Official Site", url: "https://www.trenitalia.com", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Intercity_(Italy)",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "intercity-notte",
    name: "Intercity Notte",
    logoPath: "it/intercity_notte",
    countries: ["it"],
    bounds: [6.6, 36.6, 18.5, 47.1],
    description:
      "Operating under a state subsidy contract, Intercity Notte is Italy's domestic sleeper train network. It provides vital overnight links between Northern Italy and the deep south—including Campania, Puglia, Calabria, and Sicily—offering sleeping cars, couchettes, and standard seating for long-haul territorial continuity.",
    website: "https://www.trenitalia.com",
    founded: 2010,
    headquarters: "Rome, Italy",
    networkKm: 16832,
    annualPassengers: 3_000_000,
    serviceTypes: ["night-train", "intercity"],
    parentCompany: "Trenitalia",
    links: [
      { label: "Official Site", url: "https://www.trenitalia.com", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Intercity_Notte",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "trenord",
    name: "Trenord",
    logoPath: "it/trenord",
    countries: ["it"],
    bounds: [8.5, 44.8, 11.4, 46.6],
    description:
      "A joint venture between Trenitalia and FNM (Ferrovie Nord Milano), Trenord operates the regional and suburban rail network in Lombardy. It manages one of Europe's busiest commuter systems, including the comprehensive Milan S-Bahn network, regional cross-country routes, and the Malpensa Express airport link.",
    website: "https://www.trenord.it",
    founded: 2011,
    headquarters: "Milan, Italy",
    networkKm: 1920,
    annualPassengers: 190_000_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: "Trenitalia / FNM",
    links: [
      { label: "Official Site", url: "https://www.trenord.it", type: "website" },
      {
        label: "Timetables",
        url: "https://www.trenord.it/en/routes-and-timetables/journey/train-timetable/",
        type: "timetables",
      },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Trenord", type: "wikipedia" },
    ],
  },
  {
    slug: "trenitalia-tper",
    name: "Trenitalia TPER",
    logoPath: "it/tper",
    countries: ["it"],
    bounds: [9.2, 43.8, 12.8, 45.2],
    description:
      "Created in 2020 as a joint venture between Trenitalia (70%) and regional transport provider TPER (30%), this company manages regional railway services across Emilia-Romagna. It operates a highly modernized fleet, predominantly featuring new high-capacity Rock and Pop electric multiple units.",
    website: "https://www.trenitalia.com",
    founded: 2019,
    headquarters: "Bologna, Italy",
    networkKm: 1500,
    annualPassengers: 24_000_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: "Trenitalia / TPER",
    links: [
      { label: "Official Site", url: "https://www.trenitalia.com", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Trenitalia_Tper",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "sad",
    name: "SAD",
    logoPath: "it/sad",
    countries: ["it"],
    bounds: [10.4, 46.2, 12.5, 47.1],
    description:
      "SAD operates integrated regional transport in the autonomous bilingual province of South Tyrol. Working alongside Trenitalia and ÖBB, it manages vital Alpine services on the scenic Vinschgau (Val Venosta) and Puster Valley railways, utilizing modern rolling stock tailored for steep gradients and winter conditions.",
    website: "https://www.sad.it",
    founded: 1927,
    headquarters: "Bolzano, Italy",
    networkKm: 144,
    annualPassengers: 7_000_000,
    serviceTypes: ["regional"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.sad.it", type: "website" },
      {
        label: "Wikipedia",
        url: "https://it.wikipedia.org/wiki/SAD_(azienda)",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "tua",
    name: "TUA",
    logoPath: "it/tua",
    countries: ["it"],
    bounds: [13.0, 41.7, 14.8, 42.9],
    description:
      "TUA (Trasporto Unico Abruzzese) is the consolidated public transport provider for the Abruzzo region. Its railway division, inheriting the legacy of Ferrovia Adriatico Sangritana, operates regional passenger services connecting the mountainous interior with the Adriatic coast, as well as managing local freight.",
    website: "https://www.tuabruzzo.it",
    founded: 2015,
    headquarters: "Pescara, Italy",
    networkKm: 150,
    annualPassengers: 1_200_000,
    serviceTypes: ["regional"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.tuabruzzo.it", type: "website" },
      {
        label: "Wikipedia",
        url: "https://it.wikipedia.org/wiki/Societ%C3%A0_Unica_Abruzzese_di_Trasporto",
        type: "wikipedia",
      },
    ],
  },
  // Swiss brands
  {
    slug: "sbb",
    name: "SBB CFF FFS",
    logoPath: "ch/sbb",
    countries: ["ch"],
    bounds: [5.9, 45.8, 10.5, 47.8],
    description:
      "The Swiss Federal Railways (SBB) is the backbone of Switzerland's world-renowned public transport system. Famous for its precision, national clock-face scheduling (Taktfahrplan), and engineering marvels like the Gotthard Base Tunnel, it seamlessly integrates domestic, international, and high-frequency regional transit.",
    website: "https://www.sbb.ch",
    founded: 1902,
    headquarters: "Bern, Switzerland",
    networkKm: 3230,
    annualPassengers: 522_000_000,
    serviceTypes: ["intercity", "regional", "commuter", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.sbb.ch", type: "website" },
      { label: "Timetables", url: "https://www.sbb.ch/en", type: "timetables" },
      { label: "Open API", url: "https://transport.opendata.ch/", type: "api" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Swiss_Federal_Railways",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "bls",
    name: "BLS",
    logoPath: "ch/bls",
    countries: ["ch"],
    bounds: [7.0, 46.3, 8.5, 47.1],
    description:
      "BLS is Switzerland's second-largest standard-gauge railway. In addition to operating the extensive Bern S-Bahn and regional lines in the Emmental and Bernese Oberland, BLS manages the high-speed Lötschberg Base Tunnel and provides crucial car-shuttle transport through the Alps.",
    website: "https://www.bls.ch",
    founded: 1906,
    headquarters: "Bern, Switzerland",
    networkKm: 424,
    annualPassengers: 71_000_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.bls.ch", type: "website" },
      { label: "Timetables", url: "https://www.bls.ch/en/fahren/fahrplan", type: "timetables" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/BLS_AG", type: "wikipedia" },
    ],
  },
  {
    slug: "sob",
    name: "SOB",
    logoPath: "ch/sob",
    countries: ["ch"],
    bounds: [8.2, 46.8, 9.5, 47.5],
    description:
      "Schweizerische Südostbahn (SOB) operates regional and long-distance services in central and eastern Switzerland. Known for its highly scenic routes, it runs the popular Voralpen-Express and operates modern Stadler 'Traverso' trains on the Treno Gottardo service over the historic Gotthard mountain railway.",
    website: "https://www.sob.ch",
    founded: 2001,
    headquarters: "St. Gallen, Switzerland",
    networkKm: 123,
    annualPassengers: 32_100_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.sob.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Schweizerische_S%C3%BCdostbahn",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "szu",
    name: "SZU",
    logoPath: "ch/szu",
    countries: ["ch"],
    bounds: [8.45, 47.27, 8.6, 47.4],
    description:
      "The Sihltal Zürich Uetliberg Bahn (SZU) operates two highly specialized commuter lines in the Zurich S-Bahn network. The system features standard-gauge trains on the Sihltal line and a unique, offset-overhead line setup for the steep, specialized Uetliberg mountain railway line.",
    website: "https://www.szu.ch",
    founded: 1973,
    headquarters: "Zurich, Switzerland",
    networkKm: 30,
    annualPassengers: 15_000_000,
    serviceTypes: ["commuter"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.szu.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Sihltal_Z%C3%BCrich_Uetliberg_Bahn",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "rbs",
    name: "RBS",
    logoPath: "ch/rbs",
    countries: ["ch"],
    bounds: [7.3, 46.9, 7.7, 47.2],
    description:
      "Regionalverkehr Bern-Solothurn (RBS) operates a high-frequency, metre-gauge commuter network radiating from Bern. Operating closely to S-Bahn standards, RBS manages some of the busiest narrow-gauge passenger services in Switzerland, deeply integrated into the capital's urban transit system.",
    website: "https://www.rbs.ch",
    founded: 1984,
    headquarters: "Worblaufen, Switzerland",
    networkKm: 61,
    annualPassengers: 23_500_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.rbs.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Regionalverkehr_Bern-Solothurn",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "tpf",
    name: "TPF",
    logoPath: "ch/tpf",
    countries: ["ch"],
    bounds: [6.8, 46.5, 7.4, 46.95],
    description:
      "Transports publics fribourgeois (TPF) manages a multimodal transport network in the canton of Fribourg. Its railway operations encompass both standard and metre-gauge lines, providing crucial connectivity between the bilingual canton's rural communities and urban centers like Bulle and Murten.",
    website: "https://www.tpf.ch",
    founded: 2000,
    headquarters: "Fribourg, Switzerland",
    networkKm: 122,
    annualPassengers: 8_500_000,
    serviceTypes: ["regional"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.tpf.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Transports_publics_fribourgeois",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "zb",
    name: "Zentralbahn",
    logoPath: "ch/zb",
    countries: ["ch"],
    bounds: [7.8, 46.65, 8.5, 47.05],
    description:
      "A subsidiary of SBB, Zentralbahn operates an extensive metre-gauge network connecting Lucerne with Interlaken and Engelberg. Its routes heavily utilize rack-and-pinion technology to conquer steep Alpine gradients, providing both vital commuter links and world-famous scenic tourist journeys over the Brünig Pass.",
    website: "https://www.zentralbahn.ch",
    founded: 2005,
    headquarters: "Stansstad, Switzerland",
    networkKm: 74,
    annualPassengers: 13_800_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.zentralbahn.ch", type: "website" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Zentralbahn", type: "wikipedia" },
    ],
  },
  {
    slug: "ab",
    name: "Appenzeller Bahnen",
    logoPath: "ch/ab",
    countries: ["ch"],
    bounds: [9.2, 47.25, 9.6, 47.45],
    description:
      "Appenzeller Bahnen operates a network of narrow-gauge railways in the rolling hills of northeastern Switzerland. Serving the Appenzell cantons and St. Gallen, its operations include steep adhesion lines and historic rack railways, deeply embedded in the local Alpine landscape.",
    website: "https://www.appenzellerbahnen.ch",
    founded: 2006,
    headquarters: "Herisau, Switzerland",
    networkKm: 77,
    annualPassengers: 5_500_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.appenzellerbahnen.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Appenzeller_Bahnen",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "thurbo",
    name: "Thurbo",
    logoPath: "ch/thurbo",
    countries: ["ch"],
    bounds: [8.4, 47.1, 9.7, 47.8],
    description:
      "Jointly owned by SBB and the Canton of Thurgau, Thurbo operates an extensive regional railway network in eastern Switzerland. Primarily managing the St. Gallen S-Bahn, its frequent services cross into neighboring Germany and connect numerous communities around the Lake Constance area.",
    website: "https://www.thurbo.ch",
    founded: 2001,
    headquarters: "Kreuzlingen, Switzerland",
    networkKm: 658,
    annualPassengers: 25_800_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: "SBB CFF FFS",
    links: [
      { label: "Official Site", url: "https://www.thurbo.ch", type: "website" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Thurbo", type: "wikipedia" },
    ],
  },
  {
    slug: "tpc",
    name: "TPC",
    logoPath: "ch/tpc",
    countries: ["ch"],
    bounds: [6.85, 46.15, 7.15, 46.45],
    description:
      "Transports Publics du Chablais (TPC) operates four distinct metre-gauge mountain railways originating from Aigle and Bex in the canton of Vaud. Using extensive rack-and-pinion sections, it connects the Rhône Valley to major Alpine resorts like Leysin, Les Diablerets, and Champéry.",
    website: "https://www.tpc.ch",
    founded: 1999,
    headquarters: "Aigle, Switzerland",
    networkKm: 68,
    annualPassengers: 3_000_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.tpc.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Transports_Publics_du_Chablais",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "tmr",
    name: "TMR",
    logoPath: "ch/tmr",
    countries: ["ch"],
    bounds: [6.8, 45.9, 7.2, 46.2],
    description:
      "Transports de Martigny et Régions (TMR) operates two vital railway lines in the Valais Alps: the standard-gauge Saint-Bernard Express heading towards Italy, and the metre-gauge Mont-Blanc Express, which features rack-and-pinion sections and crosses the French border directly to Chamonix.",
    website: "https://www.tmrsa.ch",
    founded: 2000,
    headquarters: "Martigny, Switzerland",
    networkKm: 50,
    annualPassengers: 2_000_000,
    serviceTypes: ["regional", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.tmrsa.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Transports_de_Martigny_et_R%C3%A9gions",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "mgb",
    name: "Matterhorn Gotthard Bahn",
    logoPath: "ch/mgb",
    countries: ["ch"],
    bounds: [7.6, 46.25, 8.85, 46.75],
    description:
      "MGB is a renowned metre-gauge railway operating in the high Alps between Zermatt, Andermatt, and Disentis. Utilizing extensive rack railway systems, it provides essential year-round transit for car-free Zermatt and co-operates the legendary Glacier Express in partnership with the RhB.",
    website: "https://www.mgbahn.ch",
    founded: 2003,
    headquarters: "Brig, Switzerland",
    networkKm: 144,
    annualPassengers: 8_500_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.mgbahn.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Matterhorn_Gotthard_Bahn",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "rhb",
    name: "Rhätische Bahn",
    logoPath: "ch/rhb",
    countries: ["ch"],
    bounds: [9.3, 46.3, 10.5, 47.0],
    description:
      "The Rhätische Bahn (RhB) operates the largest narrow-gauge network in Switzerland, covering the mountainous canton of Graubünden. Renowned globally for its engineering marvels, its Albula and Bernina lines—the latter crossing the Alps via adhesion alone without rack assistance—are a UNESCO World Heritage site.",
    website: "https://www.rhb.ch",
    founded: 1889,
    headquarters: "Chur, Switzerland",
    networkKm: 385,
    annualPassengers: 12_000_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.rhb.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Rhaetian_Railway",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "ra",
    name: "RegionAlps",
    logoPath: "ch/ra",
    countries: ["ch"],
    bounds: [6.9, 46.1, 8.1, 46.5],
    description:
      "A joint venture between SBB, TMR, and the Canton of Valais, RegionAlps provides the regional passenger rail service along the Rhône Valley. It connects communities from St-Gingolph on Lake Geneva to Brig, forming the backbone of local transit in the Valais.",
    website: "https://www.regionalps.ch",
    founded: 2003,
    headquarters: "Martigny, Switzerland",
    networkKm: 146,
    annualPassengers: 9_100_000,
    serviceTypes: ["regional"],
    parentCompany: "SBB CFF FFS / TMR / Canton of Valais",
    links: [
      { label: "Official Site", url: "https://www.regionalps.ch", type: "website" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/RegionAlps", type: "wikipedia" },
    ],
  },
  {
    slug: "mob",
    name: "MOB",
    logoPath: "ch/mob",
    countries: ["ch"],
    bounds: [6.9, 46.4, 7.5, 46.8],
    description:
      "Montreux–Oberland Bernois (MOB) operates a scenic metre-gauge railway linking Lake Geneva with the Bernese Oberland. It is internationally famous for the GoldenPass Express, which features innovative variable-gauge trains that seamlessly transition from metre to standard gauge at Zweisimmen.",
    website: "https://www.mob.ch",
    founded: 2001,
    headquarters: "Montreux, Switzerland",
    networkKm: 77,
    annualPassengers: 3_600_000,
    serviceTypes: ["regional", "scenic"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.mob.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Montreux%E2%80%93Bernese_Oberland_railway",
        type: "wikipedia",
      },
    ],
  },
  {
    slug: "flp",
    name: "FLP",
    logoPath: "ch/flp",
    countries: ["ch"],
    bounds: [8.9, 45.95, 9.05, 46.05],
    description:
      "Ferrovie Luganesi (FLP) operates a high-frequency, metre-gauge commuter railway connecting Lugano with Ponte Tresa on the Italian border. Integrated as line S60 of the Ticino S-Bahn, it serves as a critical rapid transit artery for the densely populated Malcantone region.",
    website: "https://www.flp.ch",
    founded: 1912,
    headquarters: "Lugano, Switzerland",
    networkKm: 12,
    annualPassengers: 3_000_000,
    serviceTypes: ["regional", "commuter"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.flp.ch", type: "website" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Lugano%E2%80%93Ponte_Tresa_railway",
        type: "wikipedia",
      },
    ],
  },
  // International / Other brands
  {
    slug: "obb",
    name: "ÖBB",
    logoPath: "obb",
    countries: ["it", "ch"],
    bounds: [9.5, 46.3, 17.2, 48.9],
    description:
      "The Austrian Federal Railways (ÖBB) operates a comprehensive domestic and international network. It is Europe's leading night train operator through its expansive Nightjet network, while its high-speed Railjet services provide premier daytime connections across Austria, Germany, Switzerland, and Italy.",
    website: "https://www.oebb.at",
    founded: 1947,
    headquarters: "Vienna, Austria",
    networkKm: 5000,
    annualPassengers: 469_000_000,
    serviceTypes: ["high-speed", "intercity", "night-train", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.oebb.at", type: "website" },
      { label: "Timetables", url: "https://fahrplan.oebb.at/", type: "timetables" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/%C3%96BB", type: "wikipedia" },
    ],
  },
  {
    slug: "sncf",
    name: "SNCF",
    logoPath: "sncf",
    countries: ["ch", "it", "be"],
    bounds: [-5.1, 42.3, 9.6, 51.1],
    description:
      "The French National Railway Company (SNCF) operates one of Europe's largest rail networks. World-renowned for pioneering the TGV high-speed network, it manages everything from rapid international connections (TGV inOui, Ouigo) to extensive regional transit (TER) across France and into neighboring nations.",
    website: "https://www.sncf.com",
    founded: 1938,
    headquarters: "Saint-Denis, France",
    networkKm: 29273,
    annualPassengers: 1_800_000_000,
    serviceTypes: ["high-speed", "intercity", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.sncf.com", type: "website" },
      {
        label: "Timetables",
        url: "https://www.sncf-connect.com/en-en/timetables",
        type: "timetables",
      },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/SNCF", type: "wikipedia" },
    ],
  },
  {
    slug: "vr",
    name: "VR",
    logoPath: "vr",
    countries: ["fi"],
    bounds: [20.6, 59.8, 31.6, 70.1],
    description:
      "VR Group is Finland's state-owned railway company, operating on a 1,524 mm broad-gauge network. Designed to withstand harsh Nordic winters, VR provides comprehensive high-speed Pendolino, InterCity, and extensive commuter services, alongside critical heavy freight operations.",
    website: "https://www.vr.fi",
    founded: 1862,
    headquarters: "Helsinki, Finland",
    networkKm: 5918,
    annualPassengers: 93_000_000,
    serviceTypes: ["high-speed", "intercity", "regional", "commuter", "night-train"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.vr.fi", type: "website" },
      { label: "Timetables", url: "https://www.vr.fi/en/timetables", type: "timetables" },
      { label: "Open API", url: "https://www.digitraffic.fi/en/railway-traffic/", type: "api" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/VR_Group", type: "wikipedia" },
    ],
  },
  {
    slug: "sncb",
    name: "SNCB/NMBS",
    logoPath: "sncb",
    countries: ["be"],
    bounds: [2.5, 49.5, 6.4, 51.5],
    description:
      "The National Railway Company of Belgium (SNCB/NMBS) operates one of the world's most densely spaced railway networks. It provides high-frequency intercity and local services, functioning as a central hub for international transit in Western Europe and managing the comprehensive Brussels RER system.",
    website: "https://www.belgiantrain.be",
    founded: 1926,
    headquarters: "Brussels, Belgium",
    networkKm: 3536,
    annualPassengers: 245_000_000,
    serviceTypes: ["intercity", "regional", "commuter"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.belgiantrain.be", type: "website" },
      {
        label: "Timetables",
        url: "https://www.belgiantrain.be/en/travel-info/current-timetable",
        type: "timetables",
      },
      { label: "Open API", url: "https://api.irail.be", type: "api" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/SNCB", type: "wikipedia" },
    ],
  },
  {
    slug: "eurostar",
    name: "Eurostar",
    logoPath: "eurostar",
    countries: ["be"],
    bounds: [-0.5, 48.8, 5.5, 52.4],
    description:
      "Eurostar operates high-speed international rail services connecting the UK with mainland Europe via the Channel Tunnel. Following its merger with Thalys, the unified Eurostar brand now also manages the premier high-speed network linking Paris, Brussels, Amsterdam, and Cologne, creating a unified Western European high-speed giant.",
    website: "https://www.eurostar.com",
    founded: 1994,
    headquarters: "London, United Kingdom",
    networkKm: null,
    annualPassengers: 20_000_000,
    serviceTypes: ["high-speed", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.eurostar.com", type: "website" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Eurostar", type: "wikipedia" },
    ],
  },
  {
    slug: "db",
    name: "Deutsche Bahn",
    logoPath: "db",
    countries: ["ch", "it", "be"],
    bounds: [5.9, 47.3, 15.0, 55.1],
    description:
      "Deutsche Bahn (DB) is Germany's national railway operator and a major force in European transit. Its ICE (Intercity-Express) network forms the high-speed backbone of Central Europe, deeply integrated with regular-interval timetables that connect major German hubs with Switzerland, Austria, and beyond.",
    website: "https://www.bahn.de",
    founded: 1994,
    headquarters: "Berlin, Germany",
    networkKm: 33399,
    annualPassengers: 1_600_000_000,
    serviceTypes: ["high-speed", "intercity", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.bahn.de", type: "website" },
      { label: "Timetables", url: "https://int.bahn.de/en/timetable", type: "timetables" },
      { label: "Open API", url: "https://developers.deutschebahn.com/", type: "api" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Deutsche_Bahn", type: "wikipedia" },
    ],
  },
  {
    slug: "ns",
    name: "NS",
    logoPath: "ns",
    countries: ["nl"],
    bounds: [3.3, 50.75, 7.2, 53.5],
    description:
      "Nederlandse Spoorwegen (NS) operates the principal passenger railway network in the Netherlands. Known for its extremely high-frequency, timetable-less ('Spoorboekloos') operations on major corridors, NS runs a modern, 100% wind-powered electric fleet providing crucial intercity and sprinter services.",
    website: "https://www.ns.nl",
    founded: 1938,
    headquarters: "Utrecht, Netherlands",
    networkKm: 3223,
    annualPassengers: 475_000_000,
    serviceTypes: ["intercity", "regional", "commuter", "international"],
    parentCompany: null,
    links: [
      { label: "Official Site", url: "https://www.ns.nl", type: "website" },
      { label: "Timetables", url: "https://www.ns.nl/en/journeyplanner", type: "timetables" },
      { label: "Open API", url: "https://apiportal.ns.nl/", type: "api" },
      {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Nederlandse_Spoorwegen",
        type: "wikipedia",
      },
    ],
  },
];

export const brandBySlug = new Map<string, Brand>(brands.map((b) => [b.slug, b]));
