import { aprilReport as previousReport, julyReport as report } from "@/lib/reports";
import { createFileRoute, Link } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import {
  ReportPage,
  ReportMetric as ComparisonMetric,
  ReportNote as DataNote,
  ReportSection as ArticleSection,
  ReportStationTable,
  toReportStations,
} from "@/components/reports/report-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

export const Route = createFileRoute("/report/2026-07-24")({
  head: () => metadataToHead(metadata),
  component: AnalyticsReportPage,
});

const metadata: Metadata = {
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
    images: [
      {
        url: "/assets/social/report-2026-07-24.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar Traffic Report for July 2026 showing station visits, unique visitors, countries, and top station data.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/social/report-2026-07-24.webp"],
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");
const topByVisits = toReportStations(report.topStationsByVisits);
const topByUnique = toReportStations(report.topStationsByUnique);

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
  return (
    <span className="font-medium text-foreground tabular-nums">
      {formatChange(current, previous)}
    </span>
  );
}

function CountryTable() {
  return (
    <Table>
      <caption className="sr-only">Country traffic in the July snapshot</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Country</TableHead>
          <TableHead scope="col" className="text-right">
            Current visits
          </TableHead>
          <TableHead scope="col" className="text-right">
            Previous visits
          </TableHead>
          <TableHead scope="col" className="text-right">
            Change
          </TableHead>
          <TableHead scope="col" className="text-right">
            Current unique
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.countries.map(([country, currentVisits, previousVisits, currentUnique]) => (
          <TableRow key={country}>
            <TableCell className="font-medium text-foreground">{country}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(currentVisits)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {previousVisits === null ? (
                <span className="text-muted-foreground">New</span>
              ) : (
                formatNumber(previousVisits)
              )}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {previousVisits === null ? (
                <span className="font-medium text-foreground">New</span>
              ) : (
                <Change current={currentVisits} previous={previousVisits} />
              )}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(currentUnique)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StationLeaderboards() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ReportStationTable title="Most station visits" stations={topByVisits} />
      <ReportStationTable title="Most observed identifiers" stations={topByUnique} />
    </div>
  );
}

function ProviderTable() {
  return (
    <Table>
      <caption className="sr-only">
        Live provider calls and fetch timings in the July snapshot
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Provider</TableHead>
          <TableHead scope="col" className="text-right">
            Requests
          </TableHead>
          <TableHead scope="col" className="text-right">
            Success
          </TableHead>
          <TableHead scope="col" className="text-right">
            Avg fetch
          </TableHead>
          <TableHead scope="col" className="text-right">
            P50 fetch
          </TableHead>
          <TableHead scope="col" className="text-right">
            P95 fetch
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.providers.map(([provider, requests, successRate, avg, p50, p95]) => (
          <TableRow key={provider}>
            <TableCell className="font-medium text-foreground">{provider}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(requests)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {successRate.toFixed(1)}%
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(avg)} ms
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(p50)} ms
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(p95)} ms
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AnalyticsReportPage() {
  return (
    <ReportPage
      publishedAt="2026-07-24"
      title="Rail Radar grew beyond its first markets in the next 90 days"
      windowLabel="April 25 – July 24, 2026 · rolling snapshot"
      introduction={
        <>
          The second public traffic snapshot shows a larger and more international audience. Station
          visits tripled, unique visitors nearly quintupled, and Germany moved ahead of Italy by raw
          traffic. The mix also changed: Zürich HB now reaches the broadest audience, while one
          repeat-heavy station in Düsseldorf makes the visit leaderboard much more concentrated than
          it was in April.
        </>
      }
    >
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <ComparisonMetric
          label="Station visits"
          value={report.summary.totalVisits}
          previousLabel="April"
          previous={previousReport.summary.totalVisits}
          detail="Traffic is just over three times the first snapshot."
        />
        <ComparisonMetric
          label="Unique visitors"
          value={report.summary.uniqueVisitors}
          previousLabel="April"
          previous={previousReport.summary.uniqueVisitors}
          detail="Audience growth outpaced the increase in repeat views."
        />
        <ComparisonMetric
          label="Countries"
          value={report.summary.countriesWithTraffic}
          previousLabel="April"
          previous={previousReport.summary.countriesWithTraffic}
          detail="France and Poland are new in this comparison."
        />
        <ComparisonMetric
          label="Stations visited"
          value={report.summary.stationsVisited}
          previousLabel="April"
          previous={previousReport.summary.stationsVisited}
          detail="More traffic reached a smaller set of stations."
        />
      </div>

      <ArticleSection title="How to read the comparison">
        <p>
          The current snapshot covers the rolling 90 days from{" "}
          <strong className="font-medium text-foreground">{report.firstSeen}</strong> to{" "}
          <strong className="font-medium text-foreground">{report.lastSeen}</strong>. It is compared
          with the archived first report, which covered{" "}
          <strong className="font-medium text-foreground">{previousReport.firstSeen}</strong> to{" "}
          <strong className="font-medium text-foreground">{previousReport.lastSeen}</strong>.
        </p>
        <DataNote>
          Analytics Engine retains a rolling window, so this is a comparison between two saved
          snapshots rather than two perfectly adjacent quarters. The windows overlap from April 25
          through April 28, and the first report spans three additional days. Raw percentage changes
          are useful directional signals, not accounting-grade cohort measurements. This snapshot
          was queried on July 24 at 09:20 UTC: July 24 is partial, and the earliest retained event
          on April 25 is from 02:12 UTC.
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
          healthy companion to the audience growth: the total is less dependent on a small group of
          people returning repeatedly, even though a few individual stations still show that
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
          {formatChange(report.summary.departuresCount, previousReport.summary.departuresCount)} for
          departures.
        </p>
      </ArticleSection>

      <ArticleSection title="Germany takes the lead as every established market grows">
        <p>
          Germany recorded 18,710 visits, moving from fifth place in the April report to first.
          Italy also grew strongly to 15,721 visits, while Switzerland reached 9,185. France and
          Poland appear for the first time and together contributed 4,667 visits.
        </p>
        <p>
          The country ranking now has more depth. Ireland passed the United Kingdom, Denmark rose
          from 13 visits to more than 3,000, and Belgium and the Netherlands continued to build on
          their early March launches. Every country present in both reports recorded more visits in
          the current snapshot.
        </p>
        <CountryTable />
        <DataNote>
          Germany&apos;s lead needs context: Düsseldorf Hbf alone generated 7,553 visits, or 40% of
          German traffic, from only 55 unique visitors. Germany still has broad reach—1,040
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
          Milano Centrale remains a durable anchor. Its visits grew from 845 to 3,791 and its unique
          audience more than doubled from 254 to 552. Bruxelles-Midi and Amsterdam Centraal also
          remain in both top-ten leaderboards, evidence that the international audience is
          compounding rather than simply rotating between markets.
        </p>
        <StationLeaderboards />
        <p>
          The top ten stations now account for {report.summary.top10Share.toFixed(1)}% of all
          visits, up from {previousReport.summary.top10Share.toFixed(1)}%. Most of that increase is
          explained by a few repeat-heavy stations. The unique-visitor list is therefore the better
          guide to broad audience demand, while the visit list exposes habitual or automated-looking
          usage that deserves separate monitoring.
        </p>
      </ArticleSection>

      <ArticleSection title="Provider reliability holds up under higher demand">
        <p>
          Most providers stayed above 98% success while request volume expanded. RFI handled 15,941
          requests at a 98.1% success rate, and the Swiss provider handled 9,116 at 99.8%. National
          Rail, Digitraffic, Trafiklab, and Rejseplanen recorded 100% success in the retained
          sample.
        </p>
        <ProviderTable />
        <p>
          Latency remains the clearest operational gap. RFI&apos;s median response was 926 ms and
          its p95 was just over seven seconds. PLK has a lower request count but the slowest median
          at 1.79 seconds. By contrast, iRail and Irish Rail returned median responses in 58 ms and
          52 ms respectively.
        </p>
      </ArticleSection>

      <ArticleSection title="What the next snapshot should answer">
        <p>
          The growth question has changed. In April, the uncertainty was whether later markets could
          catch up once they had a full quarter. They did: Germany now leads, Ireland is in the top
          five, and France and Poland already contribute meaningful traffic. The next report should
          focus less on whether demand exists and more on its quality—how much is broad audience
          growth, how much is repeat use, and whether station discovery spreads beyond the current
          leaders.
        </p>
        <p>
          This report also reinforces a data lesson for future quarters. Because the underlying
          retention is rolling, snapshots need to be exported on a fixed cadence if we want strictly
          adjacent windows. The April baseline made this comparison possible; the July snapshot now
          preserves the next one.
        </p>
        <p>
          <Link
            to="/report/2026-04-28"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Read the April 28 baseline report
          </Link>
          .
        </p>
      </ArticleSection>
    </ReportPage>
  );
}
