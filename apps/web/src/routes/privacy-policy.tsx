import { createFileRoute, Link } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { ArrowLeftIcon } from "lucide-react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => metadataToHead(metadata),
  component: PrivacyPolicyPage,
});

const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Rail Radar - Learn how we handle your data.",
  robots: { index: false },
};

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Rail Radar
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: October 19, 2026</p>

      <div className="space-y-8 leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">1. Introduction</h2>
          <p>
            Welcome to Rail Radar (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). This Privacy
            Policy explains how we collect, use, and protect your information when you use our
            website at railradar24.com and its API (the &quot;Service&quot;), including station
            boards, line and operator directories, network maps, and mobile app signup forms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">2. Information We Collect</h2>

          <h3 className="mb-2 text-lg font-medium text-foreground">
            2.1 Information Collected Automatically
          </h3>
          <p className="mb-3">
            When you visit our Service, we automatically collect certain information, including:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              Your IP address to serve requests and enforce API, station-board, and signup rate
              limits. Station-visit analytics store a hashed representation rather than your raw IP
              address; infrastructure providers may separately process raw IP addresses
            </li>
            <li>Browser type and version</li>
            <li>
              Pages visited, including station, line, and operator pages, page URLs and query
              parameters, and page timing information
            </li>
            <li>Referring website</li>
            <li>Device type and operating system</li>
            <li>Approximate country, network speed, and Web Vitals performance measurements</li>
            <li>Stations viewed, including the type of data requested (arrivals or departures)</li>
            <li>
              Provider response times, success or error status, and the station and board type
              requested, to monitor live-data reliability
            </li>
          </ul>
          <p className="mt-3">
            Hashed IP addresses are pseudonymous identifiers, not a guarantee of anonymity. We use
            station-visit counts to produce aggregate statistics such as trending stations.
          </p>

          <h3 className="mb-2 mt-4 text-lg font-medium text-foreground">2.2 Local Storage</h3>
          <p className="mb-3">
            We use your browser&apos;s local storage to keep the following on your device:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Recently viewed stations (up to 3, including station details and coordinates)</li>
            <li>Saved/bookmarked stations (up to 7, including station details and coordinates)</li>
            <li>
              Your last device location and the time it was saved, with a 24-hour validity period
            </li>
            <li>Whether you have dismissed an announcement banner</li>
          </ul>
          <p className="mt-3">
            We do not sync your saved or recent station lists to an account or upload them as lists.
            Viewing a station still generates the requests and analytics described above. Search
            terms, selected stations, directory filters, and map position may also appear in page
            URLs, browser history, shared links, request logs, and pageview analytics.
          </p>

          <h3 className="mb-2 mt-4 text-lg font-medium text-foreground">2.3 Geolocation</h3>
          <p>
            The Service may request access to your device&apos;s location to center the map on your
            position, either when the map opens or when you use the &quot;locate me&quot; feature.
            Access is optional and controlled by your browser&apos;s permission settings. If you
            allow it, we cache your last location on your device for reuse for up to 24 hours. Map
            coordinates may be added to the page URL and included in pageview analytics, and Mapbox
            receives requests for the area you view. Location information is therefore not confined
            to local storage. You can revoke location permission in your browser and clear the
            stored location by clearing this site&apos;s data.
          </p>

          <h3 className="mb-2 mt-4 text-lg font-medium text-foreground">2.4 Mobile App Signup</h3>
          <p>
            If you sign up for the Android beta, we store the email address you enter. We use it to
            add your Google account to the closed test on Google Play and to email you about the
            beta, your invite, any promo code, and the app&apos;s launch. To have your email
            removed, reply to any beta email or contact us.
          </p>
          <p className="mt-2">
            If you join the iPhone waitlist, we add your email to a separate list from the Android
            beta and use it to notify you about iPhone availability, the beta, and the launch. The
            iPhone app is not currently available. To have your email removed, reply to any waitlist
            email or contact us.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            3. How We Use Your Information
          </h2>
          <p className="mb-3">We use the collected information to:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Provide and maintain the Service</li>
            <li>Analyze usage patterns to improve the Service (e.g., trending stations)</li>
            <li>Monitor and prevent technical issues</li>
            <li>Enforce rate limits to protect the Service from abuse</li>
            <li>
              Send mobile app beta, availability, and launch emails to people who sign up for them
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">4. Third-Party Services</h2>
          <p className="mb-3">We use the following third-party services:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <a
                href="https://posthog.com/privacy"
                className="font-semibold text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                PostHog (EU)
              </a>{" "}
              &mdash; for website analytics and Web Vitals performance monitoring. The SDK uses
              in-memory identifiers that can associate events while a page is open, without
              persisting analytics identifiers in cookies or browser storage. Session recording and
              automatic click capture are disabled. Analytics requests are routed through our domain
              (t.railradar24.com) to PostHog&apos;s EU infrastructure
            </li>
            <li>
              <a
                href="https://www.mapbox.com/legal/privacy"
                className="font-semibold text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mapbox
              </a>{" "}
              &mdash; for interactive map rendering and static map images (may collect IP addresses,
              coordinates, and map interaction data)
            </li>
            <li>
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                className="font-semibold text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cloudflare
              </a>{" "}
              &mdash; for hosting the website and API on Cloudflare Workers, serving static assets,
              security and rate limiting, storing station photos in an EU R2 bucket, and storing
              operational analytics in Analytics Engine. As our infrastructure provider, Cloudflare
              may process request information such as IP addresses in accordance with its privacy
              policy
            </li>
            <li>
              <a
                href="https://resend.com/legal/privacy-policy"
                className="font-semibold text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resend
              </a>{" "}
              &mdash; for storing mobile app signups and sending beta emails. Resend processes your
              email address and email delivery data, such as opens and bounces, in accordance with
              its privacy policy
            </li>
            <li>
              <strong className="text-foreground">Transit data providers</strong> &mdash; live
              station boards are fetched by our API from the providers listed in our{" "}
              <Link to="/terms-of-service" className="text-foreground underline">
                Terms of Service
              </Link>
              . Requests are made by our servers and include the requested station and timetable
              information. We do not forward your browser&apos;s IP address, saved stations, or
              device location to transit data providers
            </li>
            <li>
              <strong className="text-foreground">Polar</strong> &mdash; if you choose to support
              Rail Radar, you leave our site for Polar&apos;s checkout. Polar and its payment
              providers process contact, billing, and payment information under{" "}
              <a
                href="https://polar.sh/legal/privacy-policy"
                className="text-foreground underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Polar&apos;s Privacy Policy
              </a>
              . Payment card details are entered in the external checkout
            </li>
            <li>
              <strong className="text-foreground">Fonts</strong> &mdash; font files are bundled and
              self-hosted with the app; browsers do not request fonts from a third-party font
              service when loading the Service
            </li>
          </ul>
          <p className="mt-3">
            These services may collect information as described in their respective privacy
            policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">5. Cookies</h2>
          <p>
            We do not use our own cookies for tracking purposes. PostHog is configured in a
            cookieless mode with in-memory identifiers, as described above. Local storage is used
            for the features listed in Section 2.2. Some third-party services integrated into our
            Service, particularly infrastructure or map providers, may use cookies or similar
            technologies as described in their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">6. Data Retention</h2>
          <p className="mb-3">
            Station-visit analytics (containing hashed IP addresses and station metadata) and
            provider reliability metrics are stored in Cloudflare Analytics Engine, which currently
            retains data for{" "}
            <a
              href="https://developers.cloudflare.com/analytics/analytics-engine/limits/"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              three months
            </a>
            . Cloudflare may also retain operational request data according to its policies and our
            account settings. PostHog event data is retained according to our project settings and
            its retention policies; using in-memory browser identifiers does not delete events
            already received by PostHog.
          </p>
          <p className="mb-3">
            Mobile app signup emails are stored in Resend while you remain on the relevant beta or
            waitlist. You can request removal by replying to an email or contacting us. Email
            delivery records are subject to Resend&apos;s retention policies, and supporter payment
            records are subject to Polar&apos;s policies and applicable legal requirements.
          </p>
          <p>
            Saved and recent stations and banner preferences remain on your device until you remove
            them or clear site data. Cached device locations are treated as expired after 24 hours
            and removed when next read; clearing site data removes them sooner.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">7. Your Rights</h2>
          <p className="mb-3">
            Under applicable data protection laws (including GDPR), you have the right to:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction or deletion of your personal data</li>
            <li>Object to or restrict processing of your personal data</li>
            <li>Data portability</li>
          </ul>
          <p className="mt-3">
            We may not be able to identify particular analytics events from hashed IP addresses or
            temporary browser identifiers. This does not affect your right to contact us about your
            data, including signup emails. To exercise your rights or withdraw from a signup list,
            please contact us using the information below. You may also lodge a complaint with your
            data protection authority.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">8. Children&apos;s Privacy</h2>
          <p>
            Our Service is not directed to children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot;
            date.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
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
