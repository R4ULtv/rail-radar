import octoberData from "./report-data/2026-10-24-summary.json" with { type: "json" };

// Archived, published figures. Keep preliminary investigations out of this dataset.
// Country and provider layouts preserve the tables in each original report.
type AprilCountryRow = [string, number, number, number, number, number, string];
type JulyCountryRow = [string, number, number | null, number];
export type StationRow = [string, string, string, number, number];
type AprilProviderRow = [string, number, string, string, string, string];
type JulyProviderRow = [string, number, number, number, number, number];
type ReleaseRow = [string, string, string];

export const aprilReport = {
  firstSeen: "2026-01-26",
  lastSeen: "2026-04-28",
  summary: {
    totalVisits: 22459,
    uniqueVisitors: 2561,
    arrivalsCount: 5922,
    departuresCount: 16537,
    stationsVisited: 4801,
    countriesWithTraffic: 11,
    visitsPerUniqueVisitor: 8.77,
    visitsPerStation: 4.68,
    top10Share: 15.6,
  },
  countries: [
    ["Italy", 5531, 1043, 1710, 3821, 507, "19.2%"],
    ["Switzerland", 2121, 428, 652, 1469, 238, "13.9%"],
    ["United Kingdom", 712, 105, 46, 666, 82, "2.8%"],
    ["Belgium", 700, 203, 211, 489, 87, "12.3%"],
    ["Germany", 524, 177, 129, 395, 123, "1.9%"],
    ["Netherlands", 411, 139, 80, 331, 38, "7.2%"],
    ["Ireland", 330, 110, 86, 244, 39, "17.7%"],
    ["Sweden", 282, 94, 114, 168, 44, "5.0%"],
    ["Norway", 229, 38, 94, 135, 17, "3.1%"],
    ["Finland", 106, 46, 30, 76, 13, "7.4%"],
    ["Denmark", 13, 8, 3, 10, 5, "1.0%"],
  ] satisfies AprilCountryRow[],
  topStationsByVisits: [
    ["Milano Centrale", "IT1728", "Italy", 845, 254],
    ["Napoli Centrale", "IT1888", "Italy", 396, 117],
    ["Roma Termini", "IT2416", "Italy", 348, 127],
    ["Brindisi", "IT741", "Italy", 311, 19],
    ["Brussel-Zuid/Bruxelles-Midi", "BE14001", "Belgium", 299, 86],
    ["Coppet", "CH01023", "Switzerland", 271, 13],
    ["Zürich HB", "CH03000", "Switzerland", 263, 108],
    ["Firenze Santa Maria Novella", "IT1325", "Italy", 262, 95],
    ["Bologna Centrale", "IT683", "Italy", 261, 94],
    ["Amsterdam Centraal", "NL058", "Netherlands", 247, 81],
  ] satisfies StationRow[],
  topStationsByUnique: [
    ["Milano Centrale", "IT1728", "Italy", 845, 254],
    ["Roma Termini", "IT2416", "Italy", 348, 127],
    ["Napoli Centrale", "IT1888", "Italy", 396, 117],
    ["Zürich HB", "CH03000", "Switzerland", 263, 108],
    ["Firenze Santa Maria Novella", "IT1325", "Italy", 262, 95],
    ["Bologna Centrale", "IT683", "Italy", 261, 94],
    ["Brussel-Zuid/Bruxelles-Midi", "BE14001", "Belgium", 299, 86],
    ["Amsterdam Centraal", "NL058", "Netherlands", 247, 81],
    ["Venezia S.Lucia", "IT3009", "Italy", 128, 67],
    ["Torino Porta Nuova", "IT2876", "Italy", 120, 58],
  ] satisfies StationRow[],
  providers: [
    ["rfi", 4221, "97.8%", "2,075 ms", "888 ms", "8,837 ms"],
    ["opendata-ch", 1359, "99.8%", "424 ms", "228 ms", "956 ms"],
    ["nationalrail", 702, "100.0%", "219 ms", "173 ms", "495 ms"],
    ["irail", 425, "100.0%", "132 ms", "87 ms", "437 ms"],
    ["ns", 354, "100.0%", "427 ms", "326 ms", "1,105 ms"],
    ["irishrail", 330, "100.0%", "161 ms", "69 ms", "617 ms"],
    ["entur", 229, "100.0%", "131 ms", "87 ms", "217 ms"],
    ["digitraffic", 51, "100.0%", "280 ms", "268 ms", "514 ms"],
  ] satisfies AprilProviderRow[],
  releases: [
    ["Initial coverage", "Italy", "Before this report window"],
    ["February 16, 2026", "Switzerland", "Swiss train data support"],
    ["March 9, 2026", "Finland, Belgium, Netherlands", "Mid-window expansion"],
    ["March 22, 2026", "United Kingdom, Ireland", "Late-window expansion"],
    ["April 3, 2026", "Germany", "German train data support"],
    ["April 17, 2026", "Denmark", "Danish train data support"],
  ] satisfies ReleaseRow[],
};

export const julyReport = {
  firstSeen: "2026-04-25",
  lastSeen: "2026-07-24",
  summary: {
    totalVisits: 69665,
    uniqueVisitors: 13076,
    arrivalsCount: 22216,
    departuresCount: 47449,
    stationsVisited: 4006,
    countriesWithTraffic: 13,
    visitsPerUniqueVisitor: 5.33,
    top10Share: 37.3,
  },
  countries: [
    ["Germany", 18710, 524, 2687],
    ["Italy", 15721, 5531, 2779],
    ["Switzerland", 9185, 2121, 2036],
    ["Belgium", 4286, 700, 988],
    ["Ireland", 3644, 330, 1368],
    ["Netherlands", 3368, 411, 846],
    ["Denmark", 3088, 13, 450],
    ["France", 3072, null, 648],
    ["United Kingdom", 2721, 712, 738],
    ["Sweden", 2340, 282, 599],
    ["Poland", 1595, null, 576],
    ["Norway", 1545, 229, 393],
    ["Finland", 390, 106, 129],
  ] satisfies JulyCountryRow[],
  topStationsByVisits: [
    ["Düsseldorf Hbf", "DE00085", "Germany", 7553, 55],
    ["Zürich HB", "CH03000", "Switzerland", 4597, 1036],
    ["Milano Centrale", "IT1728", "Italy", 3791, 552],
    ["Brussel-Zuid/Bruxelles-Midi", "BE14001", "Belgium", 1899, 431],
    ["Bologna Centrale", "IT683", "Italy", 1758, 285],
    ["München Hbf", "DE00261", "Germany", 1683, 297],
    ["Cork Kent", "IE30", "Ireland", 1661, 566],
    ["Amsterdam Centraal", "NL058", "Netherlands", 1445, 401],
    ["Firenze Santa Maria Novella", "IT1325", "Italy", 802, 195],
    ["Berlin Hauptbahnhof", "DE11160", "Germany", 772, 222],
  ] satisfies StationRow[],
  topStationsByUnique: [
    ["Zürich HB", "CH03000", "Switzerland", 4597, 1036],
    ["Cork Kent", "IE30", "Ireland", 1661, 566],
    ["Milano Centrale", "IT1728", "Italy", 3791, 552],
    ["Brussel-Zuid/Bruxelles-Midi", "BE14001", "Belgium", 1899, 431],
    ["Amsterdam Centraal", "NL058", "Netherlands", 1445, 401],
    ["München Hbf", "DE00261", "Germany", 1683, 297],
    ["Bologna Centrale", "IT683", "Italy", 1758, 285],
    ["Berlin Hauptbahnhof", "DE11160", "Germany", 772, 222],
    ["Firenze Santa Maria Novella", "IT1325", "Italy", 802, 195],
    ["Frankfurt (Main) Hbf", "DE00105", "Germany", 475, 182],
  ] satisfies StationRow[],
  providers: [
    ["rfi", 15941, 98.1, 1890, 926, 7073],
    ["opendata-ch", 9116, 99.8, 576, 449, 1343],
    ["irail", 4314, 98.7, 98, 58, 237],
    ["irishrail", 3636, 99.9, 125, 52, 407],
    ["ns", 3334, 99.1, 421, 290, 1278],
    ["sncf", 3070, 97.7, 376, 266, 1027],
    ["nationalrail", 2714, 100, 266, 181, 630],
    ["entur", 1506, 98.9, 165, 129, 371],
    ["db", 1332, 98.9, 610, 480, 1427],
    ["digitraffic", 389, 100, 298, 273, 562],
    ["plk", 315, 99.7, 1586, 1786, 3051],
    ["rejseplanen", 267, 100, 252, 143, 431],
    ["trafiklab", 243, 100, 274, 164, 1089],
  ] satisfies JulyProviderRow[],
};

export const octoberReport = {
  firstSeen: octoberData.firstSeen,
  lastSeen: octoberData.lastSeen,
  summary: octoberData.summary,
};

/** Oldest first, so every comparison uses publication order. */
export const publishedReports = [
  {
    path: "/report/2026-04-28",
    publishedAt: "2026-04-28",
    label: "April 2026",
    title: "How people use Rail Radar: Traffic patterns from the first three months",
    description:
      "The first public snapshot: departure boards, major hubs and a growing European network.",
    data: aprilReport,
  },
  {
    path: "/report/2026-07-24",
    publishedAt: "2026-07-24",
    label: "July 2026",
    title: "Rail Radar grew beyond its first markets in the next 90 days",
    description:
      "A larger international audience, Germany's rise and a closer look at repeat station views.",
    data: julyReport,
  },
  {
    path: "/report/2026-10-24",
    publishedAt: "2026-10-24",
    label: "October 2026",
    title: "Rail Radar's audience more than doubled across 14 countries",
    description:
      "A larger audience, Zürich HB's lead and a transparent look at bot traffic and provider reliability.",
    data: octoberReport,
  },
] as const;

export type PublishedReport = (typeof publishedReports)[number];
