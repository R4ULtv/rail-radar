import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Rail Radar - Rules and guidelines for using our service.",
  robots: { index: false },
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Back to Rail Radar
      </Link>
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: March 5, 2026</p>

      <div className="space-y-8 leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">1. About the Service</h2>
          <p>
            Rail Radar is a free, open-source web application that provides real-time train tracking
            on an interactive map. It displays live train departures, arrivals, delays, and platform
            information for thousands of stations across multiple countries. The source code is
            available under the{" "}
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
            Train data displayed on Rail Radar is sourced from the following third-party providers.
            We do not own this data and are not affiliated with these organizations.
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
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            3. No Warranty &amp; Accuracy
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of any kind. We make no guarantees regarding the accuracy, completeness, or timeliness
            of the data. Always verify travel information with official railway operators before
            making travel decisions.
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
            The Service relies on third-party services including Mapbox for map rendering, Cloudflare
            for hosting, Google Fonts for typography, and various public transit data providers. Your
            use of these services is subject to their respective terms and privacy policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">7. Service Availability</h2>
          <p>
            We may modify, suspend, or discontinue the Service (or any part of it) at any time,
            with or without notice.
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
