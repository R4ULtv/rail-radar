import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import { metadataToHead } from "@/lib/metadata";
import { publishedReports, type PublishedReport } from "@/lib/reports";

export const Route = createFileRoute("/reports")({
  head: () =>
    metadataToHead({
      title: "Traffic reports",
      description:
        "Explore Rail Radar's public traffic reports and compare station visits, audience and European railway usage across published snapshots.",
      alternates: { canonical: "/reports" },
    }),
  component: ReportsPage,
});

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const signedPercentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  signDisplay: "exceptZero",
  maximumFractionDigits: 1,
});
const newestFirst = [...publishedReports].reverse();
const latestReport = newestFirst[0]!;
const previousReport = newestFirst[1];
const metrics = [
  {
    key: "totalVisits",
    label: "Station visits",
    description: "Successful station-board responses, including repeat requests and polling.",
  },
  {
    key: "uniqueVisitors",
    label: "Visitor identifiers",
    description:
      "Distinct IP-derived identifiers observed in each window. These are not verified people.",
  },
  {
    key: "stationsVisited",
    label: "Stations visited",
    description: "Different stations with at least one recorded visit in each window.",
  },
  {
    key: "countriesWithTraffic",
    label: "Countries",
    description: "Countries with at least one recorded station visit in each window.",
  },
] as const;

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function ReportsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-16">
      <Button
        variant="ghost"
        size="sm"
        className="mb-10 -ml-2.5"
        nativeButton={false}
        render={<Link to="/" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to Rail Radar
      </Button>

      <header className="mb-12 flex flex-col gap-4 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Behind the map
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Traffic reports</h1>
        <p className="max-w-xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
          How people use Rail Radar, one snapshot at a time. Explore the stations, countries and
          patterns behind the live map.
        </p>
      </header>

      <section aria-labelledby="archive-heading">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id="archive-heading" className="text-xl font-semibold tracking-tight">
            Published reports
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {publishedReports.length} reports
          </p>
        </div>
        <ol className="flex flex-col gap-6">
          {newestFirst.map((report, index) => (
            <li key={report.path} className="relative pl-7 md:pl-8">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-7 left-0 size-2.5 rounded-full ring-4 ring-background",
                  index === 0 ? "bg-brand" : "bg-muted-foreground",
                )}
              />
              {index < newestFirst.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-10 -bottom-10 left-1 w-px bg-border"
                />
              ) : null}
              <ReportEntry report={report} latest={index === 0} />
            </li>
          ))}
        </ol>
      </section>

      <SnapshotComparison />

      <section
        aria-labelledby="reading-heading"
        className="mt-12 flex flex-col gap-3 text-sm leading-6 text-muted-foreground"
      >
        <h2 id="reading-heading" className="font-medium text-foreground">
          Reading the numbers
        </h2>
        <p>
          Each report is an archived snapshot of its own reporting window. The windows can overlap,
          so their visits and visitor identifiers should not be added into an all-time total.
          Changes compare published snapshots, rather than equal, adjacent quarters.
        </p>
        <p>
          Visits use sampling weights; visitor identifiers and stations use observed distinct
          counts. Repeat views, automated traffic and changes in country availability can affect the
          figures. Each full report includes its own context and methodology.
        </p>
        <p>
          October&apos;s figures exclude the confirmed Fredericia spam incident. Its report also
          shows the raw totals and explains the German provider block and subsequent source change.
        </p>
      </section>
    </main>
  );
}

function ReportEntry({ report, latest }: { report: PublishedReport; latest: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <time dateTime={report.publishedAt} className="font-mono text-xs text-muted-foreground">
            {formatDate(report.publishedAt)}
          </time>
          {latest ? <Badge variant="secondary">Latest report</Badge> : null}
        </div>
        <CardTitle>
          <h3>
            <Link
              to={report.path}
              className="rounded-sm text-lg leading-7 tracking-tight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {report.title}
            </Link>
          </h3>
        </CardTitle>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {[metrics[0], metrics[1], metrics[3]].map(({ key, label }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-mono text-lg tabular-nums">
                {numberFormatter.format(report.data.summary[key])}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {formatDate(report.data.firstSeen)} – {formatDate(report.data.lastSeen)}
        </p>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={report.path} aria-label={`Read the ${report.label} report`} />}
        >
          Read report <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function SnapshotComparison() {
  const [selectedMetric, setSelectedMetric] = useState<(typeof metrics)[number]>(metrics[0]);
  const maximum = Math.max(
    ...publishedReports.map(({ data }) => data.summary[selectedMetric.key]),
    1,
  );
  const current = latestReport.data.summary[selectedMetric.key];
  const previous = previousReport?.data.summary[selectedMetric.key];

  return (
    <section aria-labelledby="comparison-heading" className="mt-16">
      <div className="mb-6 flex flex-col gap-2">
        <h2 id="comparison-heading" className="text-xl font-semibold tracking-tight">
          Across the snapshots
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          A side-by-side look at the published figures. Choose what to compare.
        </p>
      </div>
      <ToggleGroup
        aria-label="Metric to compare"
        value={[selectedMetric.key]}
        onValueChange={(values) => {
          const next = metrics.find(({ key }) => key === values[0]);
          if (next) setSelectedMetric(next);
        }}
        variant="outline"
        size="sm"
        spacing={1}
        className="mb-7 max-w-full flex-wrap"
      >
        {metrics.map(({ key, label }) => (
          <ToggleGroupItem key={key} value={key}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <figure
        aria-labelledby="metric-heading"
        aria-describedby="metric-description"
        className="flex flex-col gap-6"
      >
        <figcaption className="flex flex-col gap-1" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="metric-heading" className="font-medium">
              {selectedMetric.label}
            </h3>
            {previous !== undefined && previous > 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                {signedPercentFormatter.format((current - previous) / previous)} vs{" "}
                {previousReport!.label}
              </p>
            ) : null}
          </div>
          <p id="metric-description" className="text-sm leading-6 text-muted-foreground">
            {selectedMetric.description}
          </p>
        </figcaption>
        <ol className="flex flex-col gap-5">
          {publishedReports.map((report) => {
            const value = report.data.summary[selectedMetric.key];
            const latest = report.path === latestReport.path;
            return (
              <li key={report.path} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{report.label}</span>
                  <span className="font-mono tabular-nums">{numberFormatter.format(value)}</span>
                </div>
                <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      latest ? "bg-brand" : "bg-muted-foreground",
                    )}
                    style={{ width: `${(value / maximum) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(report.data.firstSeen)} – {formatDate(report.data.lastSeen)}
                </p>
              </li>
            );
          })}
        </ol>
      </figure>

      <div className="mt-8">
        <Table>
          <caption className="sr-only">Published report metrics by reporting window</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-0">
                In each window
              </TableHead>
              {publishedReports.map((report) => (
                <TableHead key={report.path} scope="col" className="text-right">
                  <Link
                    to={report.path}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {report.label}
                  </Link>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map(({ key, label }) => (
              <TableRow key={key}>
                <TableHead scope="row" className="pl-0">
                  {label}
                </TableHead>
                {publishedReports.map((report) => (
                  <TableCell key={report.path} className="text-right font-mono tabular-nums">
                    {numberFormatter.format(report.data.summary[key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableHead scope="row" className="pl-0">
                Departure share
              </TableHead>
              {publishedReports.map((report) => (
                <TableCell key={report.path} className="text-right font-mono tabular-nums">
                  {(
                    (report.data.summary.departuresCount / report.data.summary.totalVisits) *
                    100
                  ).toFixed(1)}
                  %
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
