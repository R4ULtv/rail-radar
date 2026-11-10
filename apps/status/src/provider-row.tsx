import {
  COUNTRY_MAP,
  isNewRailData,
  newRailDataNotice,
  RAIL_DATA_WARNINGS,
} from "@repo/data/countries";
import { PROVIDER_DETAILS, type Provider } from "@repo/data/providers";
import type { StatusLatency, StatusSummary } from "@repo/data/status";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/components/accordion";
import { Skeleton } from "@repo/ui/components/skeleton";
import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";
import {
  dayLabel,
  integer,
  milliseconds,
  observationLabel,
  percent,
  STATUS_LABELS,
  windowLabel,
} from "./format";
import { HealthLabel } from "./health-label";
import { checksOnly, ProviderHistory } from "./history";
import { latestTimedDay } from "./presentation";
import { countryStationsUrl, sharedAssetUrl } from "./site-links";
import { ProviderLogo } from "./provider-logo";

import { LatencyPanel } from "./latency-panel";
import { TrafficSources } from "./traffic-sources";

interface Props {
  provider: Provider;
  current?: StatusSummary["providers"][number];
  history?: StatusLatency["providers"][number];
  expanded: boolean;
  loading: boolean;
  historyError: boolean;
  /** Epoch ms, or 0 before hydration so prerendered rows match the first client render. */
  now: number;
}

export function ProviderRow({
  provider,
  current,
  history,
  expanded,
  loading,
  historyError,
  now,
}: Props) {
  const status = current?.status ?? "unknown";
  const latest = latestTimedDay(history?.days);
  const failures = current ? current.errors + current.timeouts : 0;
  const country = COUNTRY_MAP[provider.country];
  const details = PROVIDER_DETAILS[provider.id];
  const knownIssue = RAIL_DATA_WARNINGS[provider.country];
  const isNew = isNewRailData(provider.country, now);
  const flags = `${isNew ? ", new data source" : ""}${knownIssue ? ", known issue" : ""}`;
  return (
    <AccordionItem value={provider.id}>
      {/* The row's cells are visual; a short name keeps the heading and panel label readable. */}
      <AccordionTrigger
        className="provider-trigger"
        aria-label={`${provider.name}, ${country}: ${STATUS_LABELS[status]}${flags}`}
      >
        <span className="row-grid">
          <span className="provider-identity">
            <ProviderLogo id={provider.id} />
            <span className="identity-copy">
              <span className="provider-name">
                {provider.name}
                {isNew && (
                  <span className="new-mark" aria-hidden="true">
                    New
                  </span>
                )}
                {knownIssue && <AlertTriangle className="known-issue-mark" aria-hidden="true" />}
              </span>
              <span className="row-caption provider-country">
                <img
                  src={sharedAssetUrl(`/flags/${provider.country}.svg`)}
                  width="14"
                  height="14"
                  alt=""
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
                {country}
              </span>
            </span>
          </span>
          <span>
            <HealthLabel status={status} />
          </span>
          <span className="cell-stack row-secondary">
            <span className="mono">
              {current && current.samples >= 5 ? percent(current.successRate) : "—"}
            </span>
            <span className="row-caption">
              {current
                ? `${integer.format(current.requests)} ${current.requests === 1 ? "request" : "requests"} · ${windowLabel(current.windowMinutes)}`
                : "Unverified"}
            </span>
          </span>
          <span className="cell-stack row-secondary">
            <span className="mono">{milliseconds(latest?.latency.p50 ?? null)}</span>
            {/* Dated only when it isn't today's, so an older timing isn't read as current. */}
            {latest && !latest.partial && (
              <span className="row-caption">{dayLabel(latest.date)}</span>
            )}
          </span>
          <span className="row-secondary mono">
            {current?.lastSeen ? observationLabel(current.lastSeen) : "—"}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {expanded && (
          <div className="provider-detail">
            <div className="detail-intro">
              <div>
                <h3>About {provider.name}</h3>
                <p>
                  {details.description} Rail Radar uses it for live station boards in {country}.
                </p>
              </div>
              <div className="detail-links">
                <a
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  href={details.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {provider.name} website
                  <ArrowUpRight data-icon="inline-end" />
                </a>
                <a
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  href={countryStationsUrl(provider.country)}
                >
                  Stations in {country}
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </div>
            </div>
            {isNew && (
              <div className="data-notice new-data">
                <Sparkles aria-hidden="true" />
                <div>
                  <h4>New data source</h4>
                  <p>{newRailDataNotice(provider.country)}</p>
                </div>
              </div>
            )}
            {knownIssue && (
              <div className="data-notice known-issue">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <h4>Known issue</h4>
                  <p>{knownIssue}</p>
                </div>
              </div>
            )}
            <dl className="detail-stats">
              <div>
                <dt>Success rate · {current ? windowLabel(current.windowMinutes) : "current"}</dt>
                <dd>{percent(current?.successRate ?? null)}</dd>
              </div>
              <div>
                <dt>Failed requests</dt>
                <dd>
                  {current
                    ? `${integer.format(failures)} / ${integer.format(current.requests)}`
                    : "—"}
                </dd>
                {current && failures > 0 && (
                  <dd className="stat-note">
                    {integer.format(current.errors)} {current.errors === 1 ? "error" : "errors"} ·{" "}
                    {integer.format(current.timeouts)}{" "}
                    {current.timeouts === 1 ? "timeout" : "timeouts"}
                  </dd>
                )}
              </div>
              <div>
                <dt>Last observed</dt>
                <dd className="observation-stat">
                  {current?.lastSeen ? observationLabel(current.lastSeen) : "—"}
                </dd>
              </div>
            </dl>
            {current && (
              <TrafficSources
                current={current}
                name={provider.name}
                windowMinutes={current.windowMinutes}
              />
            )}
            <div className="detail-history">
              <div className="history-heading">
                <h4>Daily status</h4>
                {history?.days.some(checksOnly) && (
                  <span className="history-key">
                    <span aria-hidden="true" />
                    Scheduled checks only
                  </span>
                )}
              </div>
              {history ? (
                <ProviderHistory days={history.days} name={provider.name} />
              ) : loading ? (
                <Skeleton className="history-skeleton" />
              ) : (
                <p className="muted-copy">
                  {historyError
                    ? "Provider history could not be loaded. Use Refresh to try again."
                    : "Waiting for provider history."}
                </p>
              )}
            </div>
            <LatencyPanel
              days={history?.days}
              name={provider.name}
              loading={loading}
              error={historyError}
            />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
