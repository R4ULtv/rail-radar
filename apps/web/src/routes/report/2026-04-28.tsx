import { aprilReport as report } from "@/lib/reports";
import { createFileRoute } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import {
  ReportPage,
  ReportMetric as InlineMetric,
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

export const Route = createFileRoute("/report/2026-04-28")({
  head: () => metadataToHead(metadata),
  component: AnalyticsReportPage,
});

const metadata: Metadata = {
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
        url: "/assets/social/report-2026-04-28.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar Traffic Report for April 2026 showing station visits, unique visitors, countries, and top station data.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/social/report-2026-04-28.webp"],
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");
const italyTraffic = report.countries[0]!;
const switzerlandTraffic = report.countries[1]!;
const topStation = report.topStationsByVisits[0]!;
const topByVisits = toReportStations(report.topStationsByVisits);
const topByUnique = toReportStations(report.topStationsByUnique);

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function CountryTable() {
  return (
    <Table>
      <caption className="sr-only">Country traffic in the April snapshot</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Country</TableHead>
          <TableHead scope="col" className="text-right">
            Visits
          </TableHead>
          <TableHead scope="col" className="text-right">
            Unique
          </TableHead>
          <TableHead scope="col" className="text-right">
            Arrivals
          </TableHead>
          <TableHead scope="col" className="text-right">
            Departures
          </TableHead>
          <TableHead scope="col" className="text-right">
            Stations
          </TableHead>
          <TableHead scope="col" className="text-right">
            Coverage
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.countries.map(
          ([country, visits, unique, arrivals, departures, stations, coverage]) => (
            <TableRow key={country}>
              <TableCell className="font-medium text-foreground">{country}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(visits)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(unique)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(arrivals)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(departures)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(stations)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{coverage}</TableCell>
            </TableRow>
          ),
        )}
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
        Live provider calls and fetch timings in the April snapshot
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Provider</TableHead>
          <TableHead scope="col" className="text-right">
            Requests
          </TableHead>
          <TableHead scope="col" className="text-right">
            Success rate
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
            <TableCell className="text-right font-mono tabular-nums">{successRate}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{avg}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{p50}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{p95}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReleaseTimeline() {
  return (
    <Table>
      <caption className="sr-only">Coverage releases during the first report window</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Date</TableHead>
          <TableHead scope="col">Countries</TableHead>
          <TableHead scope="col">Context</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.releases.map(([date, countries, note], index) => (
          <TableRow key={date}>
            <TableCell className="font-mono tabular-nums">{date}</TableCell>
            <TableCell className="whitespace-normal font-medium text-foreground">
              {countries}
            </TableCell>
            <TableCell className="min-w-48 whitespace-normal">
              {note}
              {index > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  These countries had fewer days to accumulate traffic in this report.
                </p>
              ) : null}
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
      publishedAt="2026-04-28"
      title="How people use Rail Radar: Traffic patterns from the first three months"
      windowLabel="January 26 – April 28, 2026"
      introduction={
        <>
          Between late January and late April 2026, Rail Radar recorded its first meaningful
          cross-country usage sample. The numbers are still early, but they already show a clear
          pattern: people mostly arrive with a specific station in mind, check departures more often
          than arrivals, and concentrate around a handful of large hubs. The country rankings should
          be read alongside the release timeline, because not every market was live for the full
          period.
        </>
      }
    >
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <InlineMetric
          label="Station visits"
          value={formatNumber(report.summary.totalVisits)}
          detail={`${formatNumber(report.summary.stationsVisited)} different stations were opened at least once.`}
        />
        <InlineMetric
          label="Unique visitors"
          value={formatNumber(report.summary.uniqueVisitors)}
          detail={`${report.summary.visitsPerUniqueVisitor.toFixed(2)} station views per unique visitor on average.`}
        />
        <InlineMetric
          label="Countries"
          value={formatNumber(report.summary.countriesWithTraffic)}
          detail="Every supported country saw at least some traffic in the retained dataset."
        />
        <InlineMetric
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
          arrival boards, which fits the product's most natural job: checking what leaves next from
          a station nearby or on a planned route.
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
          available before this report window, which naturally gives it more time to collect station
          visits. Several other countries were added during March, so their totals reflect both
          demand and a shorter measurement period.
        </p>
        <p>
          Switzerland went live on February 16. Finland, Belgium, and the Netherlands followed on
          March 9; the United Kingdom and Ireland followed on March 22. Germany arrived on April 3,
          and Denmark on April 17. That timing is especially important when comparing countries near
          the middle or bottom of the table: a later launch can look like lower demand even when
          early usage is healthy.
        </p>
        <ReleaseTimeline />
        <p>
          Reading the timeline against the country table, the most interesting comparisons are the
          markets that punch above their runway. Belgium had only seven weeks of measurement and
          still landed fourth by visits; Ireland accumulated meaningful traffic in five weeks. Those
          are the early signs to watch as later cohorts mature.
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
          Finland, and Denmark all appear in the long tail. That lead is meaningful, but it is also
          helped by Italy being available earlier than several countries added in March.
        </p>
        <p>
          Belgium and the Netherlands are useful examples of why the release timeline matters: both
          were added on March 9 and still appear in the upper half of the country table. Germany and
          Denmark had much shorter windows, so their totals should be treated as early signals
          rather than mature country comparisons.
        </p>
        <DataNote>
          Country visits combine two signals: how much users wanted that market and how long that
          market was available inside the report window.
        </DataNote>
        <CountryTable />
        <p>
          Coverage, the share of a country's stations that received at least one visit, is the
          quietest column in the table, but probably the most revealing. Italy and Ireland both sit
          near 18-19%, meaning users are exploring well beyond the headline hubs. The United Kingdom
          and Germany sit near the bottom of that column despite healthy raw visits, which suggests
          demand there is still concentrated on a small set of well-known stations rather than
          spreading across the network.
        </p>
      </ArticleSection>

      <ArticleSection title="The most visited stations are familiar anchors">
        <p>
          Milano Centrale is the clear leader, with{" "}
          <strong className="font-medium text-foreground">{formatNumber(topStation[3])}</strong>{" "}
          visits and{" "}
          <strong className="font-medium text-foreground">{formatNumber(topStation[4])}</strong>{" "}
          unique visitors. The rest of the top group mixes major Italian termini, international hubs
          like Bruxelles-Midi and Zürich HB, and a few more local spikes that are worth watching in
          future reports.
        </p>
        <p>
          The top ten stations account for {report.summary.top10Share.toFixed(1)}% of all station
          traffic. That is concentrated enough to show obvious hubs, but not so concentrated that
          the map is only being used for the largest cities. To make that picture sharper, it helps
          to look at the leaderboard from two angles: which stations get the most views, and which
          stations reach the widest audience.
        </p>
        <StationLeaderboards />
        <p>
          The two lists overlap, but not entirely, and the differences are the interesting part.
          Brindisi makes the most-visited list with only nineteen unique visitors, the signature of
          a small group checking the same board repeatedly. Zürich HB and Firenze Santa Maria
          Novella, on the other hand, surface in the unique-visitor leaderboard because they pull in
          many different people rather than the same ones returning. The first pattern looks like a
          daily-commuter habit; the second looks more like trip planning and tourism. Both are valid
          uses of live train data, and both will shape how the product evolves.
        </p>
      </ArticleSection>

      <ArticleSection title="Live data providers are mostly healthy">
        <p>
          Provider health is important because every station view depends on an external rail data
          source. In this window, most providers returned successful responses almost every time,
          with several at 100.0% success in the sampled data.
        </p>
        <p>
          RFI handled the largest request volume and also shows the widest latency spread: a p50 of
          888 ms and a p95 of 8,837 ms. That makes it the main operational area to keep an eye on as
          Italian traffic grows.
        </p>
        <ProviderTable />
        <p>
          Latency is what users actually feel. A station view that waits two seconds for live
          departures feels different from one that returns in under three hundred milliseconds, and
          the spread between the fastest and slowest providers in this table is exactly that gap.
          The Italian source carries the most weight, both because it serves the most traffic and
          because its tail latency is the one most likely to leak into the user experience.
        </p>
      </ArticleSection>

      <ArticleSection title="What this snapshot is, and what comes next">
        <p>
          Three months is enough to see shape, not enough to draw conclusions. The audience is real,
          the international tail is encouraging, and the providers are mostly behaving. What the
          next report should clarify is whether the late-launch markets converge toward the leaders
          once they have had a full quarter to accumulate, and whether the long tail of station
          coverage keeps widening or settles around the same familiar hubs.
        </p>
        <p>
          Until then, treat the numbers above as a baseline rather than a verdict, a first picture
          of who shows up to a live train map, what they look at, and how the underlying data
          sources hold up when real people start asking questions of them.
        </p>
      </ArticleSection>
    </ReportPage>
  );
}
