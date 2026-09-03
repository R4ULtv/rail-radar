import { env } from "@/lib/env";

interface StaticMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  priority?: boolean;
}

export function StaticMap({ lat, lng, zoom = 15, className, priority = false }: StaticMapProps) {
  const src = `${env.apiUrl}/map/static?lat=${lat}&lng=${lng}&zoom=${zoom}`;

  return (
    <div className={className}>
      <img
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        sizes="100vw"
        src={src}
        alt="Station location"
        className="absolute inset-0 size-full object-cover object-center"
      />
      {/* Gradient overlay for visual appeal */}
      <div className="absolute inset-0 bg-linear-to-t from-background/70 via-background/30 via-25% to-transparent to-80% pointer-events-none" />

      <div className="absolute right-2 bottom-1.5 max-w-[calc(100%-1rem)] rounded-lg bg-black/20 px-1.5 py-0.5 text-[10px] leading-4 text-white/75 backdrop-blur-sm">
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
