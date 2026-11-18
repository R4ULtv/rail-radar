import type { ProviderObservations } from "@repo/data/status";
import { integer, percent, windowLabel } from "./format";

type Observations = Pick<
  ProviderObservations,
  "requests" | "successes" | "syntheticRequests" | "syntheticSuccesses"
>;

/** Splits observed requests into visitor traffic and the API's scheduled checks. */
export function trafficSources(observations: Observations) {
  const checks = observations.syntheticRequests;
  const visitors = Math.max(0, observations.requests - checks);
  return {
    visitors: {
      requests: visitors,
      successes: Math.max(0, observations.successes - observations.syntheticSuccesses),
    },
    checks: { requests: checks, successes: observations.syntheticSuccesses },
  };
}

const SOURCES = [
  { key: "visitors", label: "Visitor requests" },
  { key: "checks", label: "Scheduled checks" },
] as const;

export function TrafficSources({
  current,
  name,
  windowMinutes,
}: {
  current: Observations;
  name: string;
  windowMinutes: number;
}) {
  const split = trafficSources(current);
  const total = split.visitors.requests + split.checks.requests;
  return (
    <section className="traffic-sources" aria-label={`${name} traffic sources`}>
      <div className="traffic-heading">
        <h4>Traffic sources</h4>
        <span>{windowLabel(windowMinutes)}</span>
      </div>
      {total > 0 && (
        <div className="source-bar" aria-hidden="true">
          {SOURCES.map(({ key }) =>
            split[key].requests > 0 ? (
              <span key={key} data-source={key} style={{ flexGrow: split[key].requests }} />
            ) : null,
          )}
        </div>
      )}
      <dl className="source-list">
        {SOURCES.map(({ key, label }) => {
          const { requests, successes } = split[key];
          return (
            <div key={key} data-source={key}>
              <dt>
                <span className="source-swatch" aria-hidden="true" />
                {label}
              </dt>
              <dd className="source-count">
                {integer.format(requests)}
                {total > 0 && <small>{percent(requests / total)}</small>}
              </dd>
              <dd className="stat-note">
                {requests > 0 ? `${percent(successes / requests)} successful` : "None yet"}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
