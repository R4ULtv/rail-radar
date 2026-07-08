import Image from "next/image";

interface StaticMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  priority?: boolean;
}

export function StaticMap({ lat, lng, zoom = 15, className, priority = false }: StaticMapProps) {
  const src = `${process.env.NEXT_PUBLIC_API_URL}/map/static?lat=${lat}&lng=${lng}&zoom=${zoom}`;

  return (
    <div className={className}>
      <Image
        unoptimized
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        fill
        sizes="100vw"
        src={src}
        alt="Station location"
        className="object-cover object-center"
      />
      {/* Gradient overlay for visual appeal */}
      <div className="absolute inset-0 bg-linear-to-t from-background/70 via-background/30 via-25% to-transparent to-80% pointer-events-none" />

      <div className="absolute bottom-1.5 right-2 text-[10px] text-white/60">
        <a
          href="https://www.mapbox.com/about/maps/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © Mapbox
        </a>
        ,{" "}
        <a
          href="http://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © OpenStreetMap
        </a>
        ,{" "}
        <a
          href="https://www.mapbox.com/map-feedback/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
        >
          Improve this map
        </a>
      </div>
    </div>
  );
}
