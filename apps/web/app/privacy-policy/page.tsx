import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Rail Radar - Learn how we handle your data.",
  robots: { index: false },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Back to Rail Radar
      </Link>
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: March 5, 2026</p>

      <div className="space-y-8 leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">1. Introduction</h2>
          <p>
            Welcome to Rail Radar (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). This Privacy
            Policy explains how we collect, use, and protect your information when you use our
            website at railradar24.com (the &quot;Service&quot;).
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
              IP address (hashed using SHA-256 before storage &mdash; we do not store your raw IP
              address)
            </li>
            <li>Browser type and version</li>
            <li>Pages visited and time spent on pages</li>
            <li>Referring website</li>
            <li>Device type and operating system</li>
            <li>Stations viewed, including the type of data requested (arrivals or departures)</li>
          </ul>

          <h3 className="mb-2 mt-4 text-lg font-medium text-foreground">2.2 Local Storage</h3>
          <p className="mb-3">
            We use your browser&apos;s local storage to save preferences on your device. This data
            is not transmitted to our servers and includes:
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Recently viewed stations (up to 3 station IDs)</li>
            <li>Saved/bookmarked stations (up to 10 station IDs)</li>
            <li>Map layer preferences (station types and layer visibility settings)</li>
          </ul>

          <h3 className="mb-2 mt-4 text-lg font-medium text-foreground">2.3 Geolocation</h3>
          <p>
            The Service may request access to your device&apos;s location to center the map on your
            position. This is entirely optional and only activated when you use the &quot;locate
            me&quot; feature. Your location data is used locally in the browser and is not sent to
            our servers.
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
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">4. Third-Party Services</h2>
          <p className="mb-3">We use the following third-party services:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong className="text-foreground">Vercel Analytics</strong> &mdash; for website
              analytics and performance monitoring
            </li>
            <li>
              <strong className="text-foreground">Mapbox</strong> &mdash; for interactive map
              rendering and static map images (may collect IP addresses, coordinates, and map
              interaction data)
            </li>
            <li>
              <strong className="text-foreground">Cloudflare</strong> &mdash; for API hosting,
              security, rate limiting, and analytics data storage
            </li>
            <li>
              <strong className="text-foreground">Google Fonts</strong> &mdash; for font loading
              (requests are made to Google servers, which may log IP addresses)
            </li>
            <li>
              <strong className="text-foreground">GitHub</strong> &mdash; for serving country flag
              icon assets
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
            We do not use cookies for tracking purposes. Third-party services integrated into our
            Service (such as Mapbox and Vercel Analytics) may use cookies as described in their own
            privacy policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">6. Data Retention</h2>
          <p>
            Station visit analytics (containing hashed IP addresses and station metadata) are stored
            in Cloudflare Analytics Engine in accordance with Cloudflare&apos;s retention policies.
            We do not maintain a separate database of personal user information. Local storage data
            remains on your device until you clear your browser data.
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
            Since we hash IP addresses before storage, we may not be able to identify your specific
            data. To exercise any of these rights, please contact us using the information below.
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
