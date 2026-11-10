import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
import { PROVIDERS } from "@repo/data/providers";
import { Accordion } from "@repo/ui/components/accordion";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui/components/empty";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import { latencyQuery, reachabilityQuery, summaryQuery } from "./api";
import { ApiService } from "./api-service";
import { observationLabel } from "./format";
import { healthCounts, isCurrent, needsAttention } from "./presentation";
import { ProviderRow } from "./provider-row";

export function App() {
  const api = useQuery(reachabilityQuery);
  const summary = useQuery(summaryQuery);
  const latency = useQuery(latencyQuery);
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string[]>([]);

  // Expire old observations even while the browser is offline and polling is paused.
  // A fixed SSR value also avoids timestamps changing during Astro hydration.
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const verified = !summary.isError && isCurrent(summary.data?.generatedAt, now);
  const apiVerified = !api.isError && isCurrent(api.data?.observedAt, now);
  const current = new Map(
    verified ? summary.data?.providers.map((provider) => [provider.id, provider]) : [],
  );
  const history = new Map(latency.data?.providers.map((provider) => [provider.id, provider]));
  const counts = healthCounts(summary.data, verified, PROVIDERS.length);
  const attention = PROVIDERS.filter((provider) =>
    needsAttention(current.get(provider.id)?.status ?? "unknown"),
  );
  const providers = filter === "attention" ? attention : PROVIDERS;
  const refreshing = api.isFetching || summary.isFetching || latency.isFetching;
  const stale = summary.data && !verified && !summary.isPending;
  const hasIssues = counts.degraded + counts.outage;
  // Quiet providers lack data rather than failing, so they don't hold back an all-clear.
  const allObservedHealthy = verified && !hasIssues && counts.operational > 0;

  return (
    <>
      <ApiService observation={api.data} verified={apiVerified} pending={api.isPending} />
      <section id="providers" aria-labelledby="providers-title">
        <div className="section-heading">
          <div>
            <h2 id="providers-title">Data providers</h2>
            <p className="network-headline" aria-live="polite">
              <span
                className="status-dot"
                data-health={
                  hasIssues ? "degraded" : allObservedHealthy ? "operational" : "unknown"
                }
              />
              {summary.isPending
                ? "Reading provider observations…"
                : !verified
                  ? "Provider health is unverified"
                  : hasIssues
                    ? `${hasIssues} ${hasIssues === 1 ? "provider had" : "providers had"} elevated failures`
                    : allObservedHealthy
                      ? `All observed providers are healthy${
                          counts.unknown
                            ? ` · ${counts.unknown} with too little recent traffic`
                            : ""
                        }`
                      : "Waiting for more observations"}
            </p>
          </div>
          <div className="provider-controls">
            <ToggleGroup
              variant="outline"
              size="sm"
              value={[filter]}
              onValueChange={(values) => {
                if (values[0]) setFilter(String(values[0]));
              }}
              aria-label="Filter providers"
            >
              <ToggleGroupItem value="all">
                All <span>{PROVIDERS.length}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="attention">
                Needs attention <span>{attention.length}</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => {
                void api.refetch();
                void summary.refetch();
                void latency.refetch();
              }}
            >
              <RefreshCw data-icon="inline-start" className={cn(refreshing && "refreshing")} />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>
        {(summary.isError || latency.isError || stale) && (
          <Alert variant="destructive">
            <Info />
            <AlertTitle>
              {summary.isError || stale
                ? "Provider health could not be refreshed"
                : "Provider history could not be refreshed"}
            </AlertTitle>
            <AlertDescription>
              {summary.isError || stale
                ? "Current provider health is unverified. Available history is still shown."
                : "Previously loaded history may be out of date. Current provider health is still shown."}{" "}
              Use Refresh to try again.
            </AlertDescription>
          </Alert>
        )}
        <div className="provider-column-head row-grid" aria-hidden="true">
          <span>Provider</span>
          <span>Status</span>
          <span>Success rate</span>
          <span>Median response</span>
          <span>Last observed</span>
        </div>
        <Accordion
          className="provider-list"
          value={expanded}
          onValueChange={(value) => setExpanded(value.map(String))}
          aria-label="Data providers"
        >
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              current={current.get(provider.id)}
              history={history.get(provider.id)}
              expanded={expanded.includes(provider.id)}
              loading={latency.isPending}
              historyError={latency.isError}
              now={now}
            />
          ))}
        </Accordion>
        {providers.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No providers need attention</EmptyTitle>
              <EmptyDescription>
                All providers have enough healthy observations in the current window.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <p className="data-timestamps">
          {summary.data
            ? `Updated ${observationLabel(summary.data.generatedAt)}`
            : "Waiting for the first summary"}
        </p>
      </section>
    </>
  );
}
