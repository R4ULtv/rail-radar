import { createFileRoute, Link } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { ArrowLeftIcon } from "lucide-react";

export const Route = createFileRoute("/terms-of-service")({
  head: () => metadataToHead(metadata),
  component: TermsOfServicePage,
});

const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Rail Radar - Rules and guidelines for using our service.",
  robots: { index: false },
};

function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Rail Radar
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Terms of Service</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: October 19, 2026</p>

      <div className="space-y-8 leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">1. About the Service</h2>
          <p>
            Rail Radar is a free, open-source web application for exploring European railway
            stations, operators, and selected metro and light rail networks. It includes line
            directories, routes, stop sequences, and network maps. Live departures, arrivals,
            delays, and platform information are available for supported railway stations where a
            live provider is integrated. Metro and light rail line information does not include live
            departure boards. The source code is available under the{" "}
            <a
              href="https://opensource.org/licenses/MIT"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">2. Data Sources</h2>
          <p className="mb-3">
            Live train information displayed on Rail Radar is sourced from the following third-party
            providers. Coverage and available fields vary by provider and station. We do not own
            this data and are not affiliated with these organizations.
          </p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong className="text-foreground">Italy</strong> &mdash;{" "}
              <a
                href="https://www.rfi.it"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                RFI (Rete Ferroviaria Italiana)
              </a>
            </li>
            <li>
              <strong className="text-foreground">Switzerland</strong> &mdash;{" "}
              <a
                href="https://transport.opendata.ch"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                transport.opendata.ch
              </a>
            </li>
            <li>
              <strong className="text-foreground">Germany</strong> &mdash;{" "}
              <a
                href="https://developers.deutschebahn.com/db-api-marketplace/apis/product/160163/api/160160"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Deutsche Bahn (DB) Timetables API
              </a>
              , combining published station timetables with available updates for delays,
              cancellations, platforms, and passenger messages
            </li>
            <li>
              <strong className="text-foreground">Finland</strong> &mdash;{" "}
              <a
                href="https://www.digitraffic.fi"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Digitraffic
              </a>
            </li>
            <li>
              <strong className="text-foreground">Belgium</strong> &mdash;{" "}
              <a
                href="https://docs.irail.be"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                iRail (NMBS/SNCB)
              </a>
            </li>
            <li>
              <strong className="text-foreground">Denmark</strong> &mdash;{" "}
              <a
                href="https://www.rejseplanen.dk/"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rejseplanen
              </a>
            </li>
            <li>
              <strong className="text-foreground">Netherlands</strong> &mdash;{" "}
              <a
                href="https://www.ns.nl"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                NS (Nederlandse Spoorwegen)
              </a>
            </li>
            <li>
              <strong className="text-foreground">Norway</strong> &mdash;{" "}
              <a
                href="https://developer.entur.org"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Entur
              </a>
            </li>
            <li>
              <strong className="text-foreground">Sweden</strong> &mdash;{" "}
              <a
                href="https://www.trafiklab.se"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trafiklab
              </a>
            </li>
            <li>
              <strong className="text-foreground">Poland</strong> &mdash;{" "}
              <a
                href="https://www.plk-sa.pl"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                PKP Polskie Linie Kolejowe (PLK)
              </a>
            </li>
            <li>
              <strong className="text-foreground">United Kingdom</strong> &mdash;{" "}
              <a
                href="https://lite.realtime.nationalrail.co.uk"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                LDBWS (National Rail)
              </a>
            </li>
            <li>
              <strong className="text-foreground">Ireland</strong> &mdash;{" "}
              <a
                href="https://www.irishrail.ie"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Irish Rail (Iarnród Éireann)
              </a>
            </li>
            <li>
              <strong className="text-foreground">France</strong> &mdash;{" "}
              <a
                href="https://numerique.sncf.com/startup/api/"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                SNCF (Navitia)
              </a>
            </li>
            <li>
              <strong className="text-foreground">Luxembourg</strong> &mdash;{" "}
              <a
                href="https://data.public.lu/en/datasets/api-mobiliteit-lu/"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mobiliteit.lu
              </a>{" "}
              ({" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY 4.0
              </a>
              )
            </li>
          </ul>
          <p className="mt-3">
            Metro and light rail line data, including stop sequences and track geometry, is derived
            from OpenStreetMap and curated using operator and network information. OpenStreetMap
            data is &copy;{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap contributors
            </a>{" "}
            and is available under the{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/1-0/"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Database License (ODbL)
            </a>
            .
          </p>
          <p className="mt-3">
            The MIT License for our source code does not replace the licenses or terms that apply to
            third-party transport data, map data, photos, logos, or trademarks. Station photos carry
            their own credits and license information where available. Reuse of third-party material
            must comply with its applicable license and attribution requirements.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            3. No Warranty &amp; Accuracy
          </h2>
          <p className="mb-3">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind. We make no guarantees regarding the accuracy, completeness, or
            timeliness of the data. Always verify travel information with official railway operators
            before making travel decisions.
          </p>
          <p className="mb-3">
            Line maps, routes, stop sequences, and operator details are reference information and
            may be incomplete, approximate, or outdated. They do not show live vehicle positions or
            guarantee current service patterns, operating hours, accessibility, or disruption
            information. A station or line appearing on the map does not guarantee live data or that
            a service is operating.
          </p>
          <p>
            Live boards may show only part of a station&apos;s services or platforms and a limited
            time window. Some stations are unsupported, and an empty board does not establish that
            no trains are running. Provider outages, request limits, and caching can delay updates
            or make them unavailable. If live updates fail, the Service may display the last
            received data with a warning.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">4. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Rail Radar shall not be liable for any damages
            arising out of or related to your use of the Service. This includes, without limitation,
            any damages resulting from missed trains, incorrect schedule information, or reliance on
            data provided by the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">5. Fair Use</h2>
          <p>
            To keep the Service available for everyone, we enforce rate limits on API requests.
            Deliberately circumventing these limits or using the Service in a way that degrades it
            for others may result in temporary access restrictions.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">6. Third-Party Services</h2>
          <p>
            The Service relies on third-party services including Mapbox for map rendering,
            Cloudflare for website and API hosting, static asset delivery, station photo storage,
            security, rate limiting, and operational analytics, PostHog for website analytics and
            performance monitoring, Resend for app signup emails, and various public transit data
            providers. Optional supporter payments are handled through Polar&apos;s external
            checkout and are subject to the checkout terms shown there, including any recurring
            payment conditions. These providers&apos; respective terms and privacy policies apply to
            their services. Our handling of information is described in our{" "}
            <Link to="/privacy-policy" className="text-foreground underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">7. Service Availability</h2>
          <p>
            We may modify, suspend, or discontinue the Service (or any part of it) at any time, with
            or without notice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">8. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Changes will be posted on this page with an
            updated date. Continued use of the Service after changes constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">9. Contact Us</h2>
          <p>
            If you have any questions, please contact us at{" "}
            <a href="mailto:contact@railradar24.com" className="text-foreground underline">
              contact@railradar24.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
