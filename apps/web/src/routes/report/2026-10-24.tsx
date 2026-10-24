import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ReportPage,
  ReportMetric,
  ReportSection as Section,
  ReportStationTable as StationTable,
  ReportNote,
} from "@/components/reports/report-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { metadataToHead } from "@/lib/metadata";
import { julyReport as previous, octoberReport as report } from "@/lib/reports";

export const Route = createFileRoute("/report/2026-10-24")({
  head: () =>
    metadataToHead({
      title: "Rail Radar Traffic Report - October 2026",
      description:
        "184,209 station visits and 30,885 observed visitor identifiers across 14 countries. Rail Radar's July–October report, with bot adjustments and provider health.",
      alternates: { canonical: "/report/2026-10-24" },
      openGraph: {
        type: "article",
        title: "Rail Radar Traffic Report - October 2026",
        description:
          "A larger audience across 14 countries, Zürich HB's lead, and what bot traffic and provider outages mean for the numbers.",
        images: [
          {
            url: "/assets/social/report-2026-10-24.webp",
            width: 1200,
            height: 630,
            alt: "October 2026 Rail Radar report: 184,209 station visits, 30,885 visitor identifiers and 14 countries, after the bot incident adjustment.",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        images: ["/assets/social/report-2026-10-24.webp"],
      },
    }),
  component: OctoberReportPage,
});

const number = new Intl.NumberFormat("en-US").format;
const summary = report.summary;
const db = report.providers.find(({ provider }) => provider === "db")!;
const swiss = report.providers.find(({ provider }) => provider === "opendata-ch")!;
const rfi = report.providers.find(({ provider }) => provider === "rfi")!;
const ireland = report.countries.find(({ country }) => country === "ie")!;
const topStation = report.topStationsByVisits[0]!;
const linkClassName = "font-medium text-foreground underline underline-offset-4";

function change(current: number, old: number) {
  const value = (current / old - 1) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function OctoberReportPage() {
  return (
    <ReportPage
      publishedAt="2026-10-24"
      title="Rail Radar's audience more than doubled across 14 countries"
      windowLabel="July 24 – October 24, 2026 · 09:20 UTC boundaries · 92 days"
      introduction={
        <>
          The third public snapshot records {number(summary.totalVisits)} station visits after
          excluding a confirmed bot incident, and {number(summary.uniqueVisitors)} observed visitor
          identifiers. Germany remains the largest market by visits. Zürich HB leads both station
          rankings. Growth is substantial, but traffic quality and the reliability of the underlying
          feeds are part of the story too. Two incidents shaped this window: Danish request spam and
          a German provider block that required a change of data source.
        </>
      }
    >
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          {
            label: "Station visits",
            value: summary.totalVisits,
            old: previous.summary.totalVisits,
            detail: "After excluding the confirmed bot incident.",
          },
          {
            label: "Visitor identifiers",
            value: summary.uniqueVisitors,
            old: previous.summary.uniqueVisitors,
            detail: "Observed IP-derived identifiers; not verified people.",
          },
          {
            label: "Stations visited",
            value: summary.stationsVisited,
            old: previous.summary.stationsVisited,
            detail: "Includes broad traversal activity; see the sensitivity check below.",
          },
          {
            label: "Countries with traffic",
            value: summary.countriesWithTraffic,
            old: previous.summary.countriesWithTraffic,
            detail: "Luxembourg appears for the first time in these reports.",
          },
        ].map((metric) => (
          <ReportMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            previous={metric.old}
            previousLabel="July"
            detail={metric.detail}
          />
        ))}
      </div>

      <Section title="The first incident: Danish request spam">
        <p>
          This export starts at July 24, 2026, 09:20 UTC and ends just before October 24 at 09:20
          UTC. July&apos;s published baseline covered April 25–July 24. The percentage changes
          compare those saved snapshots: their windows differ, so they should not be read as growth
          between equal, adjacent quarters.
        </p>
        <ReportNote title="The confirmed Fredericia bot incident">
          The raw export contains {number(report.raw.visits)} visits. Excluding Fredericia (DK00079)
          on October 9 UTC removes {number(report.incident.visits)} weighted visits, leaving{" "}
          {number(summary.totalVisits)}. This incident-day approximation preserves visits to the
          station on other dates. Other traffic has not been classified as human or bot.
        </ReportNote>
        <p>
          The excluded day contains {report.incident.uniqueVisitors} observed identifiers; only{" "}
          {report.incident.identifiersRemoved} disappear from the global distinct count, because the
          others also appear outside the incident. July&apos;s published figures remain the
          baseline, including its unconfirmed repeat-heavy traffic.
        </p>
      </Section>

      <Section title="Germany leads, while growth reaches more markets">
        <p>
          Germany recorded 38,748 adjusted visits, ahead of Switzerland with 28,180 and Italy with
          26,458. The United Kingdom reached 16,480 visits, and Denmark reached 16,032 after the
          incident adjustment. Luxembourg adds a fourteenth country to the comparison.
        </p>
        <Table>
          <caption className="sr-only">
            Incident-adjusted country traffic compared with the July snapshot
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Country</TableHead>
              <TableHead scope="col" className="text-right">
                October visits
              </TableHead>
              <TableHead scope="col" className="text-right">
                July visits
              </TableHead>
              <TableHead scope="col" className="text-right">
                Change
              </TableHead>
              <TableHead scope="col" className="text-right">
                October identifiers
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.countries.map((country) => (
              <TableRow key={country.country}>
                <TableCell className="font-medium text-foreground">{country.name}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {number(country.visits)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {country.july ? number(country.july.visits) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {country.july ? change(country.visits, country.july.visits) : "New"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {number(country.uniqueVisitors)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p>
          Ireland is the exception among established markets: visits fell from 3,644 to{" "}
          {number(ireland.visits)} ({change(ireland.visits, ireland.july!.visits)}). Its{" "}
          {number(ireland.uniqueVisitors)} observed identifiers are also below July&apos;s 1,368.
          These aggregates do not establish the cause of the decline.
        </p>
      </Section>

      <Section title="Zürich HB leads both station rankings">
        <p>
          Zürich HB recorded {number(topStation.visits)} visits and{" "}
          {number(topStation.uniqueVisitors)} identifiers, compared with 4,597 and 1,036 in July.
          København H follows in both rankings. The top ten stations account for{" "}
          {summary.top10Share.toFixed(1)}% of adjusted visits, down from{" "}
          {previous.summary.top10Share.toFixed(1)}% in July.
        </p>
        <div className="grid gap-8 lg:grid-cols-2">
          <StationTable
            title="Most station visits"
            caption="Most station visits, excluding the Fredericia incident"
            stations={report.topStationsByVisits}
          />
          <StationTable
            title="Most observed identifiers"
            caption="Most observed identifiers, excluding the Fredericia incident"
            stations={report.topStationsByUnique}
          />
        </div>
        <p>
          Repeat-heavy usage remains visible. York has 3,445 visits from 31 identifiers; Plymouth
          has 2,819 from eight. Those patterns warrant investigation, but they are not confirmed bot
          incidents and remain included.
        </p>
      </Section>

      <Section title="More stations, with a qualification">
        <p>
          The snapshot includes {number(summary.stationsVisited)} distinct stations, up from{" "}
          {number(previous.summary.stationsVisited)}. Some of this breadth comes from September
          9–14, when individual identifiers traversed stations across many countries. Removing those
          six days as a sensitivity check leaves {number(report.breadthSensitivity.stationsVisited)}{" "}
          stations, still{" "}
          {change(report.breadthSensitivity.stationsVisited, previous.summary.stationsVisited)}{" "}
          versus July. The headline station count includes those days; breadth alone does not
          establish organic discovery.
        </p>
        <p>
          Departures remain the main use of the boards: {number(summary.departuresCount)} responses,
          or {((summary.departuresCount / summary.totalVisits) * 100).toFixed(1)}% of adjusted
          visits, compared with {number(summary.arrivalsCount)} arrival responses. Visits per
          observed identifier were {summary.visitsPerUniqueVisitor.toFixed(2)}, compared with{" "}
          {previous.summary.visitsPerUniqueVisitor.toFixed(2)} in July.
        </p>
      </Section>

      <Section title="The second incident: a German provider block and a new source">
        <p>
          The previous German provider blocked Rail Radar, interrupting the German boards. We
          replaced it with the DB Timetables API; the switch was committed on October 19. The saved
          analytics show successful responses returning on October 20 after the source change.
        </p>
        <p>
          The German integration&apos;s live success rate was {db.successRate.toFixed(1)}% across
          the full window, down from {db.julySuccessRate}% in July. HTTP 452 errors interrupted
          recorded successes between October 12 and October 20. Successes resumed on October 20; the
          latest seven days contain {number(db.last7Days!.successes)} successes from{" "}
          {number(db.last7Days!.requests)} calls ({db.last7Days!.successRate.toFixed(1)}%). This
          week includes both the block and the recovery. The analytics label “db” spans both
          sources, so these rates describe the integration across the transition.
        </p>
        <Table>
          <caption className="sr-only">
            Live provider calls and weighted success rates; latencies include successes and failures
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Provider</TableHead>
              <TableHead scope="col" className="text-right">
                Calls
              </TableHead>
              <TableHead scope="col" className="text-right">
                Success
              </TableHead>
              <TableHead scope="col" className="text-right">
                July
              </TableHead>
              <TableHead scope="col" className="text-right">
                Last 7 days
              </TableHead>
              <TableHead scope="col" className="text-right">
                Median
              </TableHead>
              <TableHead scope="col" className="text-right">
                p95
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.providers.map((provider) => (
              <TableRow key={provider.provider}>
                <TableCell className="font-medium text-foreground">{provider.provider}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {number(provider.requests)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {provider.successRate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {provider.julySuccessRate === null
                    ? "—"
                    : `${provider.julySuccessRate.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {provider.last7Days ? `${provider.last7Days.successRate.toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {number(provider.p50Ms)} ms
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {number(provider.p95Ms)} ms
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p>
          The Swiss feed shows why recent and full-window rates belong together. Its full-window
          success rate is {swiss.successRate.toFixed(1)}%, but all{" "}
          {number(swiss.last7Days!.requests)} calls in the latest seven days succeeded. RFI&apos;s
          median fetch time rose from {number(rfi.julyP50Ms!)} ms to {number(rfi.p50Ms)} ms, while
          its p95 is {number(rfi.p95Ms)} ms.
        </p>
        <ReportNote title="Failed boards are absent from station-visit totals">
          Station analytics record successful board responses. A provider block therefore suppresses
          recorded visits as well as affecting the service. German visit totals do not measure all
          attempted demand during the outage. Provider calls are a separate population from station
          visits and have not been adjusted for the bot incident.
        </ReportNote>
      </Section>

      <Section title="Methodology">
        <p>
          Visits count successful station-board responses, including cache hits, repeat requests and
          polling. They use Analytics Engine sampling weights. Visitor identifiers and stations use
          observed distinct counts; identifiers are derived from IP addresses and do not count
          verified people. Shared addresses, address changes, sampling and automation affect the
          figures. Country and daily distinct counts must not be added together.
        </p>
        <p>
          Provider statistics use live calls only. Success rates and fetch timings use sampling
          weights; latency includes successful and failed calls with a recorded nonnegative
          duration. Changes to polling and backoff during this window can also affect visit totals.
          The September exclusion is a sensitivity check, separate from the confirmed October bot
          adjustment.
        </p>
        <p>
          The first recorded event is July 24 at 09:20:14 UTC; the last is October 24 at 09:19:50
          UTC.
        </p>
        <p className="text-sm">
          Sources:{" "}
          <Link to="/report/2026-07-24" className={linkClassName}>
            July 24 report
          </Link>
          , Rail Radar&apos;s saved Analytics Engine export, and{" "}
          <a
            href="https://developers.cloudflare.com/analytics/analytics-engine/sampling/"
            className={linkClassName}
          >
            Cloudflare&apos;s sampling documentation
          </a>
          .
        </p>
      </Section>
    </ReportPage>
  );
}
