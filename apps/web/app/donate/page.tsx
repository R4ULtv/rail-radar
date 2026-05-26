import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  MapIcon,
  RadarIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support Rail Radar and help keep real-time European train tracking fast, useful, and independent.",
  alternates: {
    canonical: "/donate",
  },
};

const monthlyGoal = 25;
const monthlyFunded = 0;

const impactItems = [
  {
    title: "Keep live boards reliable",
    description:
      "Your support helps cover the API calls and infrastructure behind real-time station data.",
    icon: RadarIcon,
  },
  {
    title: "Expand coverage",
    description:
      "Donations make it easier to add more operators, countries, and station detail over time.",
    icon: MapIcon,
  },
  {
    title: "Stay independent",
    description:
      "Rail Radar can keep improving as a focused public tool without cluttering the experience.",
    icon: ServerIcon,
  },
];

export default function DonatePage() {
  const fundedPercent = Math.min(100, Math.round((monthlyFunded / monthlyGoal) * 100));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <Link
        href="/"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        Back to Rail Radar
      </Link>

      <div className="mb-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Support
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Help keep Rail Radar moving.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
          Rail Radar tracks thousands of European stations in real time. A small donation helps pay
          for the services that keep the map fast, the live boards fresh, and the project free to
          use.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            render={
              <a
                href="https://buy.polar.sh/polar_cl_tASj1xHmBWAiDQyuWr7zsyBSSFc9eUPZ9hwLy4cBlBN"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Become a supporter
            <ExternalLinkIcon data-icon="inline-end" className="size-4" />
          </Button>

          <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/" />}>
            Open the live map
            <ArrowRightIcon data-icon="inline-end" className="size-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheckIcon className="size-4" />
            Secure checkout via{" "}
            <a
              href="https://polar.sh"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              Polar
            </a>
          </span>
          <span className="text-foreground/15 hidden sm:inline">|</span>
          <span>One-time, monthly, or yearly</span>
        </div>
      </div>

      <section className="mb-16">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight shrink-0">
            What your donation supports
          </h2>
          <div className="h-px w-full bg-muted" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {impactItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} size="sm" className="h-full">
                <CardContent>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted/50">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-medium tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight shrink-0">Monthly goal</h2>
          <div className="h-px w-full bg-muted" />
        </div>

        <Card>
          <CardContent>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  ${monthlyFunded}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  of ${monthlyGoal}/month covered
                </span>
              </div>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {fundedPercent}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={monthlyFunded}
              aria-valuemin={0}
              aria-valuemax={monthlyGoal}
              aria-label={`Monthly funding progress: $${monthlyFunded} of $${monthlyGoal}`}
              className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${fundedPercent}%` }}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Rail Radar&apos;s monthly bill (map tiles, API calls, hosting) runs around $
              {monthlyGoal}. Once recurring donations cover that, every extra dollar goes toward
              adding new countries and operators.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight shrink-0">From the maker</h2>
          <div className="h-px w-full bg-muted" />
        </div>

        <Card>
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <Image
                unoptimized
                src="https://github.com/R4ULtv.png"
                alt="Raul Carini"
                width={72}
                height={72}
                className="size-16 sm:size-18 shrink-0 rounded-full ring-1 ring-foreground/10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Hi, I&apos;m Raul. I built Rail Radar in my spare time because I wanted a faster,
                  cleaner way to track trains across Europe. There&apos;s no team behind it, just
                  me, paying for the API calls, map tiles, and hosting out of pocket. Every donation
                  goes straight back into keeping the live boards running and adding more countries.
                  Thank you for considering it.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="font-medium tracking-tight">Raul Carini</span>
                  <span className="text-foreground/15">|</span>
                  <a
                    href="https://github.com/R4ULtv"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    github.com/R4ULtv
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                  <span className="text-foreground/15">|</span>
                  <a
                    href="https://x.com/lil_poop__"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    x.com/lil_poop__
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
