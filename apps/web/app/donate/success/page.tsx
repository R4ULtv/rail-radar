import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { ArrowLeftIcon, ExternalLinkIcon, HeartIcon, SparklesIcon } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Thank You",
  description: "Thank you for supporting Rail Radar.",
  robots: { index: false },
};

type DonationSuccessPageProps = {
  searchParams: Promise<{
    checkout_id?: string;
  }>;
};

export default async function DonationSuccessPage({ searchParams }: DonationSuccessPageProps) {
  const { checkout_id } = await searchParams;

  if (!checkout_id) {
    return redirect("/donate");
  }

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
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HeartIcon className="size-6 fill-current" />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Donation received
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-pretty">
          Thank you for supporting Rail Radar.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
          Your donation helps keep live train data accessible, fast, and useful for everyone
          planning a journey across Europe.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" nativeButton={false} render={<Link href="/" />}>
            Open the live map
            <SparklesIcon data-icon="inline-end" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/operators" />}
          >
            Browse operators
          </Button>
        </div>
      </div>

      <section>
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight shrink-0">A note from Raul</h2>
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
                  Seriously, thank you. Rail Radar is a side project I run on my own, and every
                  donation is what keeps the live boards, the map tiles, and the API calls flowing.
                  You just bought the next round of trains a little more time on the map, it means a
                  lot.
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
