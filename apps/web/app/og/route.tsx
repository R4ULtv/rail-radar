import { ImageResponse } from "@takumi-rs/image-response";
import { stations, stationById } from "@repo/data";
import type { NextRequest } from "next/server";

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function toDMS(deg: number, isLat: boolean): string {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(1);
  const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
  return `${d}°${m}'${s}"${dir}`;
}

function getNearbyStations(stationId: string) {
  const station = stationById.get(stationId);
  if (!station?.geo) return [];

  const { lat, lng } = station.geo;
  return stations
    .filter((s) => s.id !== stationId && s.geo && s.type === "rail")
    .map((s) => ({ ...s, distance: haversineDistance(lat, lng, s.geo!.lat, s.geo!.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}

export function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const station = stationById.get(id);
  if (!station?.geo) {
    return new Response("Station not found", { status: 404 });
  }

  const nearby = getNearbyStations(id);
  const coords = `${toDMS(station.geo.lat, true)} ${toDMS(station.geo.lng, false)}`;

  try {
  return new ImageResponse(
    <div tw="flex w-full h-full bg-[#1C1917]">
      {/* Dot grid background */}
      <div
        tw="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(168,162,158,0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Left content area */}
      <div tw="flex flex-col justify-between w-[560px] p-14">
        {/* Brand */}
        <div tw="flex items-center">
          <div tw="flex w-[44px] h-[44px] items-center justify-center rounded-xl bg-[#4B61D1]">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1" />
              <path d="M9 15l-1-1" />
              <path d="M15 15l1-1" />
              <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z" />
              <path d="M8 19l-2 3" />
              <path d="M16 19l2 3" />
            </svg>
          </div>
          <span tw="text-[22px] font-semibold ml-3.5 text-[#FAFAF9] tracking-tight">
            Rail Radar
          </span>
        </div>

        {/* Station info */}
        <div tw="flex flex-col">
          {/* Accent line */}
          <div tw="w-12 h-[3px] rounded-full bg-[#4B61D1]" />

          {/* Station name */}
          <span tw="text-[58px] font-extrabold mt-4 text-[#FAFAF9] leading-none tracking-[-0.04em]">
            {station.name}
          </span>

          {/* Country + Coordinates */}
          <div tw="flex flex-col mt-4">
            <span tw="text-[13px] mt-1.5 font-mono tracking-wider text-[rgba(168,162,158,0.6)]">
              {coords}
            </span>
          </div>

          {/* Nearby stations */}
          <div tw="flex flex-col mt-6">
            <span tw="text-[11px] font-light uppercase text-[#A8A29E] tracking-[0.14em]">
              Nearby Stations
            </span>
            <div tw="flex flex-col mt-2.5">
              {nearby.map((s) => (
                <div key={s.id} tw="flex items-center justify-between max-w-[380px]">
                  <span tw="text-sm text-[rgba(250,250,249,0.7)]">{s.name}</span>
                  <span tw="text-xs ml-4 font-mono text-[rgba(168,162,158,0.6)]">
                    {formatDistance(s.distance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* URL */}
        <span tw="text-[13px] font-mono text-[rgba(168,162,158,0.6)]">railradar24.com</span>
      </div>

      {/* Map — temporarily disabled for debugging */}
      {/* <div tw="absolute top-0 right-0 bottom-0 flex w-[750px]">
        <div
          tw="absolute inset-0"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 15%, rgba(0,0,0,0.5) 35%, black 60%)",
          }}
        >
          <div
            tw="absolute inset-0"
            style={{
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, black 10%, black 90%, rgba(0,0,0,0.4) 100%)",
            }}
          >
            <img
              width={750}
              height={630}
              src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${station.geo.lng - 0.007},${station.geo.lat},13,0/750x630?attribution=false&logo=false&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
              tw="absolute inset-0 w-full h-full object-cover brightness-110"
              alt=""
            />
          </div>
        </div>
      </div> */}
    </div>,
    {
      width: 1200,
      height: 630,
      format: "webp",
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
  } catch (error) {
    console.error("OG image generation failed:", error);
    return new Response(String(error), { status: 500 });
  }
}
