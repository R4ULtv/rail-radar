import { API_HOST, type ApiObservation } from "./api";
import { milliseconds, observationLabel } from "./format";
import { HealthLabel } from "./health-label";

export function ApiService({
  observation,
  verified,
  pending,
}: {
  observation?: ApiObservation;
  verified: boolean;
  pending: boolean;
}) {
  return (
    <section className="primary-service" aria-labelledby="service-title">
      <div className="api-overview">
        <div className="provider-identity api-identity">
          <img src="/favicon.svg" width="32" height="32" alt="" />
          <div className="identity-copy">
            <h2 id="service-title" className="provider-name">
              Rail Radar API
            </h2>
            <span className="row-caption mono">{API_HOST}</span>
          </div>
        </div>
        <dl className="api-current">
          <div>
            <dt className="sr-only">Current status</dt>
            <dd>
              <HealthLabel
                status={verified ? "operational" : "unknown"}
                label={pending ? "Connecting" : verified ? "Responding" : "Unverified"}
              />
            </dd>
          </div>
          <div>
            <dt>Response time</dt>
            <dd className="mono">
              {verified && observation ? milliseconds(observation.responseMs) : "—"}
            </dd>
          </div>
        </dl>
      </div>
      <p className="service-note">
        Response time includes your network connection.
        {observation ? ` Last checked ${observationLabel(observation.observedAt)}.` : ""}
      </p>
    </section>
  );
}
