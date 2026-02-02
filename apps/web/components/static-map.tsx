import Image from "next/image";

interface StaticMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}

export function StaticMap({ lat, lng, zoom = 15, className }: StaticMapProps) {
  const iconUrl = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_SITE_URL}/station-icon.png`,
  );
  const marker = `url-${iconUrl}(${lng},${lat})`;
  const src = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},${zoom},0/1280x256@2x?attribution=false&logo=false&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;

  return (
    <div className={className}>
      <Image
        unoptimized
        priority
        fill
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
