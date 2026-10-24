import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import type { StationRow } from "@/lib/reports";

const number = new Intl.NumberFormat("en-US").format;
const publicationDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function ReportPage({
  publishedAt,
  title,
  introduction,
  windowLabel,
  children,
}: {
  publishedAt: string;
  title: string;
  introduction: ReactNode;
  windowLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-16">
      <Button
        variant="ghost"
        size="sm"
        className="mb-10 -ml-2.5"
        nativeButton={false}
        render={<Link to="/reports" />}
      >
        <ArrowLeftIcon data-icon="inline-start" /> All reports
      </Button>
      <article>
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Report ·{" "}
            <time dateTime={publishedAt}>
              {publicationDate.format(new Date(`${publishedAt}T00:00:00Z`))}
            </time>
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">
            {introduction}
          </p>
          <p className="mt-4 font-mono text-xs leading-6 text-muted-foreground">{windowLabel}</p>
        </header>
        {children}
      </article>
    </main>
  );
}

export function ReportMetric({
  label,
  value,
  previous,
  previousLabel = "Previous",
  detail,
}: {
  label: string;
  value: number | string;
  previous?: number;
  previousLabel?: string;
  detail: string;
}) {
  const change =
    typeof value === "number" && previous !== undefined && previous > 0
      ? (value / previous - 1) * 100
      : null;

  return (
    <Card size="sm" className="bg-muted/25 shadow-none ring-0">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        {previous !== undefined ? (
          <CardDescription>
            {previousLabel}: {number(previous)}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {typeof value === "number" ? number(value) : value}
          </span>
          {change !== null ? (
            <span className="text-sm font-medium tabular-nums">
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-5 flex flex-col gap-5 text-base leading-8 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function ReportNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Alert role="note" className="bg-muted/25">
      <InfoIcon />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="leading-6">{children}</AlertDescription>
    </Alert>
  );
}

interface ReportStation {
  stationId: string;
  stationName: string;
  countryName: string;
  visits: number;
  uniqueVisitors: number;
}

export function toReportStations(rows: StationRow[]): ReportStation[] {
  return rows.map(([stationName, stationId, countryName, visits, uniqueVisitors]) => ({
    stationName,
    stationId,
    countryName,
    visits,
    uniqueVisitors,
  }));
}

export function ReportStationTable({
  title,
  caption = title,
  stations,
}: {
  title: string;
  caption?: string;
  stations: readonly ReportStation[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Station</TableHead>
            <TableHead scope="col" className="text-right">
              Visits
            </TableHead>
            <TableHead scope="col" className="text-right">
              Identifiers
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stations.slice(0, 5).map((station) => (
            <TableRow key={station.stationId}>
              <TableCell className="whitespace-normal">
                <Link
                  to="/station/$id"
                  params={{ id: station.stationId }}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {station.stationName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{station.countryName}</p>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {number(station.visits)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {number(station.uniqueVisitors)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
