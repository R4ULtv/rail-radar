import type { Metadata } from "next";
import Link from "next/link";
import { ActivityIcon, ArrowLeftIcon, GaugeIcon, MapPinnedIcon, UsersIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/ui/components/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

type CountryRow = [string, number, number, number, number, number, string];
type StationRow = [string, string, string, number, number];
type ProviderRow = [string, number, string, string, string, string];
type ReleaseRow = [string, string, string];

export const metadata: Metadata = {
  title: "Rail Radar Traffic Report - April 2026",
  description:
    "A public snapshot of Rail Radar traffic from January 26, 2026 to April 28, 2026, covering visits, unique visitors, top stations, country usage, and provider health.",
  alternates: {
    canonical: "/report/2026-04-28",
  },
  openGraph: {
    title: "Rail Radar Traffic Report - April 2026",
    description: "A public snapshot of Rail Radar traffic from January 26, 2026 to April 28, 2026.",
    url: "/report/2026-04-28",
    images: [
      {
        url: "/2026-04-28-report.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar Traffic Report for April 2026 showing station visits, unique visitors, countries, and top station data.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/2026-04-28-report.webp"],
  },
};

const report = {
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
  ] satisfies CountryRow[],
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
  ] satisfies ProviderRow[],
  releases: [
    ["Initial coverage", "Italy", "Before this report window"],
    ["February 16, 2026", "Switzerland", "Swiss train data support"],
    ["March 9, 2026", "Finland, Belgium, Netherlands", "Mid-window expansion"],
    ["March 22, 2026", "United Kingdom, Ireland", "Late-window expansion"],
    ["April 3, 2026", "Germany", "German train data support"],
    ["April 17, 2026", "Denmark", "Danish train data support"],
  ] satisfies ReleaseRow[],
};

const numberFormatter = new Intl.NumberFormat("en-US");
const italyTraffic = report.countries[0]!;
const switzerlandTraffic = report.countries[1]!;
const topStation = report.topStationsByVisits[0]!;
const topByVisits = report.topStationsByVisits.slice(0, 5);
const topByUnique = report.topStationsByUnique.slice(0, 5);

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function InlineMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Item variant="muted" className="items-start">
      <ItemContent>
        <ItemTitle className="gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <ItemMedia variant="icon">
            <Icon className="size-3.5" />
          </ItemMedia>
          {label}
        </ItemTitle>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        <ItemDescription className="mt-2 leading-5">{detail}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function DataNote({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Item variant="muted" className="my-8" render={<aside />}>
      <ItemContent>
        <ItemDescription className="leading-6">{children}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function ArticleSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5 space-y-5 text-base leading-8 text-muted-foreground">{children}</div>
    </section>
  );
}

function CountryTable() {
  return (
    <Card size="sm" className="not-prose mt-7 rounded-lg bg-muted/25 shadow-none ring-0">
      <CardContent>
        <Table className="min-w-190">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="px-0 text-muted-foreground">Country</TableHead>
              <TableHead className="text-muted-foreground">Visits</TableHead>
              <TableHead className="text-muted-foreground">Unique</TableHead>
              <TableHead className="text-muted-foreground">Arrivals</TableHead>
              <TableHead className="text-muted-foreground">Departures</TableHead>
              <TableHead className="text-muted-foreground">Stations</TableHead>
              <TableHead className="text-muted-foreground">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.countries.map(
              ([country, visits, unique, arrivals, departures, stations, coverage]) => (
                <TableRow key={country} className="border-0 hover:bg-transparent">
                  <TableCell className="px-0 font-medium text-foreground">{country}</TableCell>
                  <TableCell>{formatNumber(visits)}</TableCell>
                  <TableCell>{formatNumber(unique)}</TableCell>
                  <TableCell>{formatNumber(arrivals)}</TableCell>
                  <TableCell>{formatNumber(departures)}</TableCell>
                  <TableCell>{formatNumber(stations)}</TableCell>
                  <TableCell>{coverage}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StationLeaderboard({
  title,
  caption,
  stations,
  metric,
}: {
  title: string;
  caption: string;
  stations: StationRow[];
  metric: "visits" | "unique";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{caption}</span>
      </div>
      <ItemGroup className="mt-3">
        {stations.map(([name, id, country, visits, unique], index) => {
          const primary = metric === "visits" ? visits : unique;
          const secondary =
            metric === "visits"
              ? `${formatNumber(unique)} unique`
              : `${formatNumber(visits)} visits`;
          return (
            <Item key={id} variant="muted" className="items-start">
              <ItemContent>
                <ItemDescription className="text-xs">
                  #{index + 1} · {country}
                </ItemDescription>
                <ItemTitle className="mt-1 truncate text-foreground">{name}</ItemTitle>
                <ItemDescription className="mt-1 text-xs">{id}</ItemDescription>
              </ItemContent>
              <ItemActions className="self-start text-right text-sm">
                <div>
                  <div className="font-medium text-foreground">{formatNumber(primary)}</div>
                  <ItemDescription className="text-xs">{secondary}</ItemDescription>
                </div>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}

function StationLeaderboards() {
  return (
    <div className="not-prose mt-7 grid gap-6 md:grid-cols-2">
      <StationLeaderboard
        title="Most visited stations"
        caption="Top 5 by visits"
        stations={topByVisits}
        metric="visits"
      />
      <StationLeaderboard
        title="Broadest reach"
        caption="Top 5 by unique visitors"
        stations={topByUnique}
        metric="unique"
      />
    </div>
  );
}

function ProviderTable() {
  return (
    <Card size="sm" className="not-prose mt-7 rounded-lg bg-muted/25 shadow-none ring-0">
      <CardContent>
        <Table className="min-w-170">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="px-0 text-muted-foreground">Provider</TableHead>
              <TableHead className="text-muted-foreground">Requests</TableHead>
              <TableHead className="text-muted-foreground">Success rate</TableHead>
              <TableHead className="text-muted-foreground">Avg fetch</TableHead>
              <TableHead className="text-muted-foreground">P50 fetch</TableHead>
              <TableHead className="text-muted-foreground">P95 fetch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.providers.map(([provider, requests, successRate, avg, p50, p95]) => (
              <TableRow key={provider} className="border-0 hover:bg-transparent">
                <TableCell className="px-0 font-medium text-foreground">{provider}</TableCell>
                <TableCell>{formatNumber(requests)}</TableCell>
                <TableCell>{successRate}</TableCell>
                <TableCell>{avg}</TableCell>
                <TableCell>{p50}</TableCell>
                <TableCell>{p95}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReleaseTimeline() {
  return (
    <ItemGroup className="not-prose mt-7">
      {report.releases.map(([date, countries, note], index) => (
        <Item key={date} variant="muted" className="items-start">
          <ItemContent className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="text-sm font-medium text-foreground">{date}</div>
            <div>
              <ItemTitle>{countries}</ItemTitle>
              <ItemDescription className="mt-1">{note}</ItemDescription>
              {index > 0 ? (
                <ItemDescription className="mt-2 text-xs">
                  These countries had fewer days to accumulate traffic in this report.
                </ItemDescription>
              ) : null}
            </div>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

export default function AnalyticsReportPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-16">
      <Button
        variant="ghost"
        size="sm"
        className="group mb-10 -ml-2.5 text-muted-foreground hover:text-foreground"
        render={<Link href="/" />}
        nativeButton={false}
      >
        <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
        Back to Rail Radar
      </Button>

      <article>
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Report · April 28, 2026
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            How people use Rail Radar: Traffic patterns from the first three months
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">
            Between late January and late April 2026, Rail Radar recorded its first meaningful
            cross-country usage sample. The numbers are still early, but they already show a clear
            pattern: people mostly arrive with a specific station in mind, check departures more
            often than arrivals, and concentrate around a handful of large hubs. The country
            rankings should be read alongside the release timeline, because not every market was
            live for the full period.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <InlineMetric
            icon={ActivityIcon}
            label="Station visits"
            value={formatNumber(report.summary.totalVisits)}
            detail={`${formatNumber(report.summary.stationsVisited)} different stations were opened at least once.`}
          />
          <InlineMetric
            icon={UsersIcon}
            label="Unique visitors"
            value={formatNumber(report.summary.uniqueVisitors)}
            detail={`${report.summary.visitsPerUniqueVisitor.toFixed(2)} station views per unique visitor on average.`}
          />
          <InlineMetric
            icon={MapPinnedIcon}
            label="Countries"
            value={formatNumber(report.summary.countriesWithTraffic)}
            detail="Every supported country saw at least some traffic in the retained dataset."
          />
          <InlineMetric
            icon={GaugeIcon}
            label="Top 10 share"
            value={`${report.summary.top10Share.toFixed(1)}%`}
            detail="Traffic is broad, but major hubs still dominate the upper end."
          />
        </div>

        <ArticleSection title="The shape of the audience">
          <p>
            The report covers data from{" "}
            <strong className="font-medium text-foreground">{report.firstSeen}</strong> to{" "}
            <strong className="font-medium text-foreground">{report.lastSeen}</strong>. In that
            window, Rail Radar served{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.totalVisits)}
            </strong>{" "}
            station visits from{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.uniqueVisitors)}
            </strong>{" "}
            unique visitors.
          </p>
          <p>
            Departures were the dominant use case. Users opened{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.departuresCount)}
            </strong>{" "}
            departure boards compared with{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.arrivalsCount)}
            </strong>{" "}
            arrival boards, which fits the product's most natural job: checking what leaves next
            from a station nearby or on a planned route.
          </p>
          <DataNote>
            The average visitor opened {report.summary.visitsPerUniqueVisitor.toFixed(2)} station
            views. That suggests a mix of quick one-off lookups and repeat exploration across nearby
            or connected stations.
          </DataNote>
        </ArticleSection>

        <ArticleSection title="Release timing matters">
          <p>
            The country totals are not an even race. Italy had the longest runway and was already
            available before this report window, which naturally gives it more time to collect
            station visits. Several other countries were added during March, so their totals reflect
            both demand and a shorter measurement period.
          </p>
          <p>
            Switzerland went live on February 16. Finland, Belgium, and the Netherlands followed on
            March 9; the United Kingdom and Ireland followed on March 22. Germany arrived on April
            3, and Denmark on April 17. That timing is especially important when comparing countries
            near the middle or bottom of the table: a later launch can look like lower demand even
            when early usage is healthy.
          </p>
          <ReleaseTimeline />
          <p>
            Reading the timeline against the country table, the most interesting comparisons are the
            markets that punch above their runway. Belgium had only seven weeks of measurement and
            still landed fourth by visits; Ireland accumulated meaningful traffic in five weeks.
            Those are the early signs to watch as later cohorts mature.
          </p>
        </ArticleSection>

        <ArticleSection title="Italy leads, but the footprint is already international">
          <p>
            Italy is the strongest country in this snapshot, with{" "}
            <strong className="font-medium text-foreground">{formatNumber(italyTraffic[1])}</strong>{" "}
            visits. Switzerland follows with{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(switzerlandTraffic[1])}
            </strong>
            , while the United Kingdom, Belgium, Germany, the Netherlands, Ireland, Sweden, Norway,
            Finland, and Denmark all appear in the long tail. That lead is meaningful, but it is
            also helped by Italy being available earlier than several countries added in March.
          </p>
          <p>
            Belgium and the Netherlands are useful examples of why the release timeline matters:
            both were added on March 9 and still appear in the upper half of the country table.
            Germany and Denmark had much shorter windows, so their totals should be treated as early
            signals rather than mature country comparisons.
          </p>
          <DataNote>
            Country visits combine two signals: how much users wanted that market and how long that
            market was available inside the report window.
          </DataNote>
          <CountryTable />
          <p>
            Coverage, the share of a country's stations that received at least one visit, is the
            quietest column in the table, but probably the most revealing. Italy and Ireland both
            sit near 18-19%, meaning users are exploring well beyond the headline hubs. The United
            Kingdom and Germany sit near the bottom of that column despite healthy raw visits, which
            suggests demand there is still concentrated on a small set of well-known stations rather
            than spreading across the network.
          </p>
        </ArticleSection>

        <ArticleSection title="The most visited stations are familiar anchors">
          <p>
            Milano Centrale is the clear leader, with{" "}
            <strong className="font-medium text-foreground">{formatNumber(topStation[3])}</strong>{" "}
            visits and{" "}
            <strong className="font-medium text-foreground">{formatNumber(topStation[4])}</strong>{" "}
            unique visitors. The rest of the top group mixes major Italian termini, international
            hubs like Bruxelles-Midi and Zürich HB, and a few more local spikes that are worth
            watching in future reports.
          </p>
          <p>
            The top ten stations account for {report.summary.top10Share.toFixed(1)}% of all station
            traffic. That is concentrated enough to show obvious hubs, but not so concentrated that
            the map is only being used for the largest cities. To make that picture sharper, it
            helps to look at the leaderboard from two angles: which stations get the most views, and
            which stations reach the widest audience.
          </p>
          <StationLeaderboards />
          <p>
            The two lists overlap, but not entirely, and the differences are the interesting part.
            Brindisi makes the most-visited list with only nineteen unique visitors, the signature
            of a small group checking the same board repeatedly. Zürich HB and Firenze Santa Maria
            Novella, on the other hand, surface in the unique-visitor leaderboard because they pull
            in many different people rather than the same ones returning. The first pattern looks
            like a daily-commuter habit; the second looks more like trip planning and tourism. Both
            are valid uses of live train data, and both will shape how the product evolves.
          </p>
        </ArticleSection>

        <ArticleSection title="Live data providers are mostly healthy">
          <p>
            Provider health is important because every station view depends on an external rail data
            source. In this window, most providers returned successful responses almost every time,
            with several at 100.0% success in the sampled data.
          </p>
          <p>
            RFI handled the largest request volume and also shows the widest latency spread: a p50
            of 888 ms and a p95 of 8,837 ms. That makes it the main operational area to keep an eye
            on as Italian traffic grows.
          </p>
          <ProviderTable />
          <p>
            Latency is what users actually feel. A station view that waits two seconds for live
            departures feels different from one that returns in under three hundred milliseconds,
            and the spread between the fastest and slowest providers in this table is exactly that
            gap. The Italian source carries the most weight, both because it serves the most traffic
            and because its tail latency is the one most likely to leak into the user experience.
          </p>
        </ArticleSection>

        <ArticleSection title="What this snapshot is, and what comes next">
          <p>
            Three months is enough to see shape, not enough to draw conclusions. The audience is
            real, the international tail is encouraging, and the providers are mostly behaving. What
            the next report should clarify is whether the late-launch markets converge toward the
            leaders once they have had a full quarter to accumulate, and whether the long tail of
            station coverage keeps widening or settles around the same familiar hubs.
          </p>
          <p>
            Until then, treat the numbers above as a baseline rather than a verdict, a first picture
            of who shows up to a live train map, what they look at, and how the underlying data
            sources hold up when real people start asking questions of them.
          </p>
        </ArticleSection>
      </article>
    </main>
  );
}
