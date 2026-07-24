import type { Metadata } from "next";
import Link from "next/link";
import {
  ActivityIcon,
  ArrowLeftIcon,
  GaugeIcon,
  MapPinnedIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
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

type CountryRow = [string, number, number | null, number];
type StationRow = [string, string, string, number, number];
type ProviderRow = [string, number, number, number, number, number];

export const metadata: Metadata = {
  title: "Rail Radar Traffic Report - July 2026",
  description:
    "Rail Radar's rolling 90-day traffic report for April 25 to July 24, 2026, compared with the first public snapshot from January to April.",
  alternates: {
    canonical: "/report/2026-07-24",
  },
  openGraph: {
    title: "Rail Radar Traffic Report - July 2026",
    description:
      "A rolling 90-day comparison of Rail Radar traffic, station usage, country growth, and provider health.",
    url: "/report/2026-07-24",
  },
  twitter: {
    card: "summary",
  },
};

const previousReport = {
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
    top10Share: 15.6,
  },
};

const report = {
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
  ] satisfies CountryRow[],
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
  ] satisfies ProviderRow[],
};

const numberFormatter = new Intl.NumberFormat("en-US");
const topByVisits = report.topStationsByVisits.slice(0, 5);
const topByUnique = report.topStationsByUnique.slice(0, 5);

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function percentageChange(current: number, previous: number) {
  return ((current - previous) / previous) * 100;
}

function formatChange(current: number, previous: number) {
  const change = percentageChange(current, previous);
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function Change({ current, previous }: { current: number; previous: number }) {
  const change = percentageChange(current, previous);
  const Icon = change >= 0 ? TrendingUpIcon : TrendingDownIcon;

  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground tabular-nums">
      <Icon className="size-3.5" />
      {formatChange(current, previous)}
    </span>
  );
}

function ComparisonMetric({
  label,
  current,
  previous,
  detail,
  icon: Icon,
}: {
  label: string;
  current: number;
  previous: number;
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
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {formatNumber(current)}
          </span>
          <Change current={current} previous={previous} />
        </div>
        <ItemDescription className="mt-2 leading-5">
          Previous: {formatNumber(previous)}. {detail}
        </ItemDescription>
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
      <div className="mt-5 flex flex-col gap-5 text-base leading-8 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function CountryTable() {
  return (
    <Card size="sm" className="not-prose mt-7 rounded-lg bg-muted/25 shadow-none ring-0">
      <CardContent>
        <Table className="min-w-175">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="px-0 text-muted-foreground">Country</TableHead>
              <TableHead className="text-muted-foreground">Current visits</TableHead>
              <TableHead className="text-muted-foreground">Previous visits</TableHead>
              <TableHead className="text-muted-foreground">Change</TableHead>
              <TableHead className="text-muted-foreground">Current unique</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.countries.map(([country, currentVisits, previousVisits, currentUnique]) => (
              <TableRow key={country} className="border-0 hover:bg-transparent">
                <TableCell className="px-0 font-medium text-foreground">{country}</TableCell>
                <TableCell>{formatNumber(currentVisits)}</TableCell>
                <TableCell>
                  {previousVisits === null ? (
                    <span className="text-muted-foreground">New</span>
                  ) : (
                    formatNumber(previousVisits)
                  )}
                </TableCell>
                <TableCell>
                  {previousVisits === null ? (
                    <span className="font-medium text-foreground">New</span>
                  ) : (
                    <Change current={currentVisits} previous={previousVisits} />
                  )}
                </TableCell>
                <TableCell>{formatNumber(currentUnique)}</TableCell>
              </TableRow>
            ))}
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
              <TableHead className="text-muted-foreground">Success</TableHead>
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
                <TableCell>{successRate.toFixed(1)}%</TableCell>
                <TableCell>{formatNumber(avg)} ms</TableCell>
                <TableCell>{formatNumber(p50)} ms</TableCell>
                <TableCell>{formatNumber(p95)} ms</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
        <ArrowLeftIcon
          data-icon="inline-start"
          className="transition-transform group-hover:-translate-x-0.5"
        />
        Back to Rail Radar
      </Button>

      <article>
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Report · July 24, 2026
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Rail Radar grew beyond its first markets in the next 90 days
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">
            The second public traffic snapshot shows a larger and more international audience.
            Station visits tripled, unique visitors nearly quintupled, and Germany moved ahead of
            Italy by raw traffic. The mix also changed: Zürich HB now reaches the broadest audience,
            while one repeat-heavy station in Düsseldorf makes the visit leaderboard much more
            concentrated than it was in April.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <ComparisonMetric
            icon={ActivityIcon}
            label="Station visits"
            current={report.summary.totalVisits}
            previous={previousReport.summary.totalVisits}
            detail="Traffic is just over three times the first snapshot."
          />
          <ComparisonMetric
            icon={UsersIcon}
            label="Unique visitors"
            current={report.summary.uniqueVisitors}
            previous={previousReport.summary.uniqueVisitors}
            detail="Audience growth outpaced the increase in repeat views."
          />
          <ComparisonMetric
            icon={MapPinnedIcon}
            label="Countries"
            current={report.summary.countriesWithTraffic}
            previous={previousReport.summary.countriesWithTraffic}
            detail="France and Poland are new in this comparison."
          />
          <ComparisonMetric
            icon={GaugeIcon}
            label="Stations visited"
            current={report.summary.stationsVisited}
            previous={previousReport.summary.stationsVisited}
            detail="More traffic reached a smaller set of stations."
          />
        </div>

        <ArticleSection title="How to read the comparison">
          <p>
            The current snapshot covers the rolling 90 days from{" "}
            <strong className="font-medium text-foreground">{report.firstSeen}</strong> to{" "}
            <strong className="font-medium text-foreground">{report.lastSeen}</strong>. It is
            compared with the archived first report, which covered{" "}
            <strong className="font-medium text-foreground">{previousReport.firstSeen}</strong> to{" "}
            <strong className="font-medium text-foreground">{previousReport.lastSeen}</strong>.
          </p>
          <DataNote>
            Analytics Engine retains a rolling window, so this is a comparison between two saved
            snapshots rather than two perfectly adjacent quarters. The windows overlap from April 25
            through April 28, and the first report spans three additional days. Raw percentage
            changes are useful directional signals, not accounting-grade cohort measurements. This
            snapshot was queried on July 24 at 09:20 UTC: July 24 is partial, and the earliest
            retained event on April 25 is from 02:12 UTC.
          </DataNote>
          <p>
            Within those limits, the direction is unambiguous. Visits rose from{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(previousReport.summary.totalVisits)}
            </strong>{" "}
            to{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.totalVisits)}
            </strong>
            , a {formatChange(report.summary.totalVisits, previousReport.summary.totalVisits)}{" "}
            increase. Unique visitors climbed even faster, from{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(previousReport.summary.uniqueVisitors)}
            </strong>{" "}
            to{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.uniqueVisitors)}
            </strong>
            .
          </p>
        </ArticleSection>

        <ArticleSection title="A larger audience, with fewer views per person">
          <p>
            The average visitor opened {report.summary.visitsPerUniqueVisitor.toFixed(2)} station
            views, down from {previousReport.summary.visitsPerUniqueVisitor.toFixed(2)}. That is a
            healthy companion to the audience growth: the total is less dependent on a small group
            of people returning repeatedly, even though a few individual stations still show that
            behavior.
          </p>
          <p>
            Departures remain the main job people use Rail Radar for. The current window contains{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.departuresCount)}
            </strong>{" "}
            departure views and{" "}
            <strong className="font-medium text-foreground">
              {formatNumber(report.summary.arrivalsCount)}
            </strong>{" "}
            arrival views. Both grew, but arrivals increased faster:{" "}
            {formatChange(report.summary.arrivalsCount, previousReport.summary.arrivalsCount)}{" "}
            compared with{" "}
            {formatChange(report.summary.departuresCount, previousReport.summary.departuresCount)}{" "}
            for departures.
          </p>
        </ArticleSection>

        <ArticleSection title="Germany takes the lead as every established market grows">
          <p>
            Germany recorded 18,710 visits, moving from ninth place in the April report to first.
            Italy also grew strongly to 15,721 visits, while Switzerland reached 9,185. France and
            Poland appear for the first time and together contributed 4,667 visits.
          </p>
          <p>
            The country ranking now has more depth. Ireland passed the United Kingdom, Denmark rose
            from 13 visits to more than 3,000, and Belgium and the Netherlands continued to build on
            their early March launches. Every country present in both reports recorded more visits
            in the current snapshot.
          </p>
          <CountryTable />
          <DataNote>
            Germany&apos;s lead needs context: Düsseldorf Hbf alone generated 7,553 visits, or 40%
            of German traffic, from only 55 unique visitors. Germany still has broad reach—1,040
            different stations were visited—but the raw total includes an unusually concentrated
            repeat-use pattern.
          </DataNote>
        </ArticleSection>

        <ArticleSection title="The visit leader and the audience leader tell different stories">
          <p>
            Düsseldorf Hbf is first by visits, but Zürich HB is first by unique visitors with 1,036.
            Zürich grew from 263 visits and 108 unique visitors in the April report to 4,597 visits
            and 1,036 unique visitors now. Cork Kent is another major newcomer to the top group,
            reaching 566 unique visitors.
          </p>
          <p>
            Milano Centrale remains a durable anchor. Its visits grew from 845 to 3,791 and its
            unique audience more than doubled from 254 to 552. Bruxelles-Midi and Amsterdam Centraal
            also remain in both top-five reach lists, evidence that the international audience is
            compounding rather than simply rotating between markets.
          </p>
          <StationLeaderboards />
          <p>
            The top ten stations now account for {report.summary.top10Share.toFixed(1)}% of all
            visits, up from {previousReport.summary.top10Share.toFixed(1)}%. Most of that increase
            is explained by a few repeat-heavy stations. The unique-visitor list is therefore the
            better guide to broad audience demand, while the visit list exposes habitual or
            automated-looking usage that deserves separate monitoring.
          </p>
        </ArticleSection>

        <ArticleSection title="Provider reliability holds up under higher demand">
          <p>
            Most providers stayed above 98% success while request volume expanded. RFI handled
            15,941 requests at a 98.1% success rate, and the Swiss provider handled 9,116 at 99.8%.
            National Rail, Digitraffic, Trafiklab, and Rejseplanen recorded 100% success in the
            retained sample.
          </p>
          <ProviderTable />
          <p>
            Latency remains the clearest operational gap. RFI&apos;s median response was 926 ms and
            its p95 was just over seven seconds. PLK has a lower request count but the slowest
            median at 1.79 seconds. By contrast, iRail and Irish Rail returned median responses in
            58 ms and 52 ms respectively.
          </p>
        </ArticleSection>

        <ArticleSection title="What the next snapshot should answer">
          <p>
            The growth question has changed. In April, the uncertainty was whether later markets
            could catch up once they had a full quarter. They did: Germany now leads, Ireland is in
            the top five, and France and Poland already contribute meaningful traffic. The next
            report should focus less on whether demand exists and more on its quality—how much is
            broad audience growth, how much is repeat use, and whether station discovery spreads
            beyond the current leaders.
          </p>
          <p>
            This report also reinforces a data lesson for future quarters. Because the underlying
            retention is rolling, snapshots need to be exported on a fixed cadence if we want
            strictly adjacent windows. The April baseline made this comparison possible; the July
            snapshot now preserves the next one.
          </p>
          <p>
            <Link
              href="/report/2026-04-28"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Read the April 28 baseline report
            </Link>
            .
          </p>
        </ArticleSection>
      </article>
    </main>
  );
}
