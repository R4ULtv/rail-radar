"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
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

function safeHttpsUrl(value?: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function PhotoAttribution({ attribution }: { attribution?: StationPhotoAttribution }) {
  const parts = attributionParts(attribution);
  const sourceUrl = safeHttpsUrl(attribution?.sourceUrl);
  const originLabel = attribution?.origin ?? "Origin";

  if (parts.length === 0 && !sourceUrl && !attribution?.sourceUrl) {
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
      {parts.length > 0 && !sourceUrl && attribution?.sourceUrl && <span> · </span>}
      {!sourceUrl && attribution?.sourceUrl && <span>{originLabel}</span>}
    </div>
  );
}

export function StationGallery({ stationName, lat, lng, photos }: StationGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const programmaticScrollIndexRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startIndex: number;
    scrollLeft: number;
    hasDragged: boolean;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
      const nextIndex = Math.min(Math.max(index, 0), items.length - 1);
      const scroller = scrollerRef.current;
      const slide = scroller?.children.item(nextIndex) as HTMLElement | null;

      if (!slide) {
        programmaticScrollIndexRef.current = null;
        setActiveIndex(nextIndex);
        return;
      }

      programmaticScrollIndexRef.current = nextIndex;
      slide.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
      setActiveIndex(nextIndex);
    },
    [items.length],
  );

  const endDrag = useCallback(
    (pointerId: number) => {
      const scroller = scrollerRef.current;
      const dragState = dragStateRef.current;

      if (!scroller || dragState?.pointerId !== pointerId) {
        return;
      }

      dragStateRef.current = null;
      setIsDragging(false);

      if (scroller.hasPointerCapture(pointerId)) {
        scroller.releasePointerCapture(pointerId);
      }

      if (dragState.hasDragged) {
        const dragDistance = scroller.scrollLeft - dragState.scrollLeft;
        const dragThreshold = Math.min(scroller.clientWidth * 0.22, 180);
        const nextIndex =
          Math.abs(dragDistance) >= dragThreshold
            ? dragState.startIndex + Math.sign(dragDistance)
            : dragState.startIndex;

        scrollToIndex(nextIndex);
      }
    },
    [scrollToIndex],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const scroller = scrollerRef.current;

      if (
        !scroller ||
        event.pointerType !== "mouse" ||
        items.length <= 1 ||
        (event.target instanceof Element && event.target.closest("a, button"))
      ) {
        return;
      }

      programmaticScrollIndexRef.current = null;
      scroller.setPointerCapture(event.pointerId);
      scroller.focus({ preventScroll: true });
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startIndex: activeIndex,
        scrollLeft: scroller.scrollLeft,
        hasDragged: false,
      };
      setIsDragging(true);
    },
    [activeIndex, items.length],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const scroller = scrollerRef.current;
      const dragState = dragStateRef.current;

      if (!scroller || dragState?.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;

      if (Math.abs(deltaX) > 2) {
        dragState.hasDragged = true;
      }

      scroller.scrollLeft = dragState.scrollLeft - deltaX;
      const dragDistance = scroller.scrollLeft - dragState.scrollLeft;
      const dragThreshold = Math.min(scroller.clientWidth * 0.22, 180);
      const nextIndex =
        Math.abs(dragDistance) >= dragThreshold
          ? dragState.startIndex + Math.sign(dragDistance)
          : dragState.startIndex;

      setActiveIndex(Math.min(Math.max(nextIndex, 0), items.length - 1));
      event.preventDefault();
    },
    [items.length],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (items.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollToIndex(activeIndex + 1);
      }
    },
    [activeIndex, items.length, scrollToIndex],
  );

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    if (dragStateRef.current) {
      return;
    }

    const programmaticScrollIndex = programmaticScrollIndexRef.current;
    if (programmaticScrollIndex !== null) {
      const targetScrollLeft = programmaticScrollIndex * scroller.clientWidth;

      if (Math.abs(scroller.scrollLeft - targetScrollLeft) <= 1) {
        programmaticScrollIndexRef.current = null;
      }

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
        role="region"
        aria-label={`${stationName} station image gallery`}
        tabIndex={items.length > 1 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endDrag(event.pointerId)}
        onPointerCancel={(event) => endDrag(event.pointerId)}
        onLostPointerCapture={(event) => endDrag(event.pointerId)}
        onDragStart={(event) => event.preventDefault()}
        className={cn(
          "flex size-full snap-x snap-mandatory select-none overflow-x-auto scroll-smooth scrollbar-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset [&::-webkit-scrollbar]:hidden",
          items.length > 1 && "md:cursor-grab",
          isDragging && "snap-none scroll-auto md:cursor-grabbing",
        )}
      >
        {items.map((item, index) => (
          <div key={item.key} className="relative size-full shrink-0 snap-start overflow-hidden">
            {item.type === "map" ? (
              <StaticMap lat={lat} lng={lng} zoom={14} priority className="absolute inset-0" />
            ) : (
              <>
                <Image
                  unoptimized
                  fill
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
        <div className="absolute bottom-3 hidden md:flex md:left-1/2 md:-translate-x-1/2 gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              aria-label={`Show station image ${index + 1}`}
              aria-current={activeIndex === index}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "size-1.5 rounded-full bg-white/45 ring-1 ring-black/10 transition-[width,background-color] duration-200 ease-out hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                activeIndex === index && "w-5 bg-white/90",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
