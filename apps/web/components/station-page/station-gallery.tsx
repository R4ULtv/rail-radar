"use client";

import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { StaticMap } from "@/components/static-map";
import type { StationPhoto, StationPhotoAttribution } from "@/lib/station-photos";

interface StationGalleryProps {
  stationName: string;
  lat: number;
  lng: number;
  photos: StationPhoto[];
}

type GalleryItem =
  | {
      type: "map";
      key: "map";
      alt: string;
    }
  | {
      type: "photo";
      key: string;
      url: string;
      alt: string;
      attribution?: StationPhotoAttribution;
    };

function attributionParts(attribution?: StationPhotoAttribution) {
  if (!attribution) {
    return [];
  }

  const license = attribution.license?.toLowerCase() ?? "";
  const isPublicDomain =
    license.includes("public domain") ||
    license === "cc0" ||
    license.startsWith("pdm") ||
    license.startsWith("cc-pd");

  const authorCredit = attribution.author
    ? isPublicDomain
      ? attribution.author
      : `© ${attribution.author}`
    : null;

  return [authorCredit, attribution.license].filter(
    (part, index, parts): part is string =>
      typeof part === "string" && parts.indexOf(part) === index,
  );
}

function PhotoAttribution({ attribution }: { attribution?: StationPhotoAttribution }) {
  const parts = attributionParts(attribution);
  const sourceUrl = attribution?.sourceUrl;
  const originLabel = attribution?.origin ?? "Origin";

  if (parts.length === 0 && !sourceUrl) {
    return null;
  }

  return (
    <div className="absolute right-2 bottom-1.5 max-w-[calc(100%-1rem)] rounded-sm bg-black/45 px-1.5 py-0.5 text-[10px] leading-4 text-white/75 backdrop-blur-sm">
      {parts.length > 0 && <span>{parts.join(" · ")}</span>}
      {parts.length > 0 && sourceUrl && <span> · </span>}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
        >
          {originLabel}
        </a>
      )}
    </div>
  );
}

export function StationGallery({ stationName, lat, lng, photos }: StationGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo<GalleryItem[]>(
    () => [
      {
        type: "map",
        key: "map",
        alt: `${stationName} location map`,
      },
      ...photos.map((photo) => ({
        type: "photo" as const,
        key: photo.key,
        url: photo.url,
        alt: photo.alt ?? `${stationName} station photo`,
        attribution: photo.attribution,
      })),
    ],
    [photos, stationName],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const nextIndex = (index + items.length) % items.length;
      const scroller = scrollerRef.current;
      const slide = scroller?.children.item(nextIndex) as HTMLElement | null;

      slide?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
      setActiveIndex(nextIndex);
    },
    [items.length],
  );

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const nextIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setActiveIndex(Math.min(Math.max(nextIndex, 0), items.length - 1));
  }, [items.length]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <div key={item.key} className="relative size-full shrink-0 snap-start overflow-hidden">
            {item.type === "map" ? (
              <StaticMap lat={lat} lng={lng} zoom={14} className="absolute inset-0" />
            ) : (
              <>
                <Image
                  unoptimized
                  fill
                  priority={index === 1}
                  sizes="100vw"
                  src={item.url}
                  alt={item.alt}
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background/45 via-transparent to-transparent pointer-events-none" />
                <PhotoAttribution attribution={item.attribution} />
              </>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 gap-1.5 md:flex">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              aria-label={`Show station image ${index + 1}`}
              aria-current={activeIndex === index}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "size-1.5 rounded-full bg-white/45 ring-1 ring-black/10 transition-all hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                activeIndex === index && "w-5 bg-white/90",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
