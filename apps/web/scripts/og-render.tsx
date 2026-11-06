import { readFileSync } from "node:fs";
import React from "react";
import { measure, render } from "takumi-js";
import { COUNTRY_MAP, getCountry } from "../../../packages/data/src/countries.ts";
import type { Station } from "../../../packages/data/src/types.ts";
import {
  LIGHT_ICON_SVG,
  FREIGHT_ICON_SVG,
  METRO_ICON_SVG,
  RAIL_ICON_SVG,
  svgDataUri,
} from "../src/lib/station-marker-icons.ts";

// Shared with the input fingerprint: bump revision to refresh maps when their upstream style changes.
export const MAP_STYLE = "mapbox/dark-v11";
export const MAP_REVISION = "1";
export function stationMapPath(geo: { lat: number; lng: number }): string {
  return `${MAP_STYLE}/static/${geo.lng},${geo.lat},14.2,0/${MAP_WIDTH}x${HEIGHT}.webp`;
}

const WIDTH = 1200;
const HEIGHT = 630;
const MAP_WIDTH = 664;
const MAP_LEFT = WIDTH - MAP_WIDTH;
const TITLE_WIDTH = 508;
const TITLE_HEIGHT = 188;
const BACKGROUND = "#1C1917";

const fonts = [
  {
    name: "Geist",
    data: readFileSync(new URL("../src/assets/fonts/Geist/Geist[wght].woff2", import.meta.url)),
  },
  {
    name: "Geist Mono",
    data: readFileSync(new URL("../src/assets/fonts/Geist/GeistMono.woff2", import.meta.url)),
  },
];

const stationMarkers = {
  rail: { src: svgDataUri(RAIL_ICON_SVG), label: "Rail station" },
  freight: { src: svgDataUri(FREIGHT_ICON_SVG), label: "Freight yard" },
  metro: { src: svgDataUri(METRO_ICON_SVG), label: "Metro station" },
  light: { src: svgDataUri(LIGHT_ICON_SVG), label: "Light rail station" },
};

const dotGrid = svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="0.8" fill="white"/></pattern></defs>
  <rect width="1200" height="630" fill="url(#dots)"/>
</svg>`);

const brandIcon =
  svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <rect width="44" height="44" rx="11" fill="#6363FF"/>
  <svg width="30.25" height="30.25" x="6.875" y="6.875" viewBox="-4.986 -4.99 2.063 2.063">
    <path fill="white" d="M-4.298-3.529q-.037 0-.061-.024T-4.384-3.615t.025-.061T-4.298-3.701h.343q-.03-.037-.048-.079T-4.032-3.872H-4.47q-.037 0-.061-.025T-4.556-3.958t.025-.062T-4.47-4.044h.438q.011-.049.029-.093T-3.955-4.216H-4.298q-.037 0-.061-.025T-4.384-4.302t.025-.061T-4.298-4.388h.687q.178 0 .304.126T-3.181-3.958t-.126.304T-3.611-3.529z m.687-.172q.107 0 .183-.075T-3.353-3.958t-.075-.183T-3.611-4.216t-.182.075T-3.869-3.958t.076.182T-3.611-3.701M-4.642-3.529q-.037 0-.061-.024T-4.728-3.615t.025-.061T-4.642-3.701h.086q.037 0 .061.025T-4.47-3.615t-.025.062T-4.556-3.529z"/>
  </svg>
</svg>`);

function stationNameStyle(fontSize: number) {
  return {
    width: TITLE_WIDTH,
    fontFamily: "Geist",
    fontWeight: 750,
    fontSize,
    lineHeight: `${fontSize}px`,
    letterSpacing: "-0.055em",
    textWrap: "balance",
    overflowWrap: "anywhere",
  } as const;
}

async function fitStationName(name: string): Promise<number> {
  const fits = async (fontSize: number) => {
    const { height } = await measure(<div style={stationNameStyle(fontSize)}>{name}</div>, {
      fonts,
    });
    return height <= TITLE_HEIGHT;
  };

  if (await fits(94)) return 94;

  let min = 32;
  let max = 93;
  while (min < max) {
    const middle = Math.ceil((min + max) / 2);
    if (await fits(middle)) min = middle;
    else max = middle - 1;
  }
  return min;
}

function formatCoordinate(value: number, latitude: boolean): string {
  const direction = latitude ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  return `${Math.abs(value).toFixed(5)}° ${direction}`;
}

export async function renderStationOg(
  station: Station & { geo: { lat: number; lng: number } },
  map: Uint8Array,
): Promise<Uint8Array> {
  const name = station.name.replace(/\s+/g, " ").trim();
  const fontSize = await fitStationName(name);
  const country = getCountry(station.id);
  const flag = country
    ? readFileSync(new URL(`../public/assets/flags/${country}.svg`, import.meta.url), "utf8")
    : undefined;
  const marker = stationMarkers[station.type];
  const coords = `${formatCoordinate(station.geo.lat, true)} · ${formatCoordinate(station.geo.lng, false)}`;

  return render(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: WIDTH,
        height: HEIGHT,
        overflow: "hidden",
        backgroundColor: BACKGROUND,
        color: "#FAFAF9",
        fontFamily: "Geist",
      }}
    >
      <img
        src={dotGrid}
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", opacity: 0.12 }}
        alt=""
      />

      {map ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: MAP_LEFT,
            top: 0,
            width: MAP_WIDTH,
            height: HEIGHT,
            maskImage:
              "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.3) 12%, rgba(0,0,0,0.8) 29%, black 44%)",
          }}
        >
          <img src="station-map" width={MAP_WIDTH} height={HEIGHT} alt="" />
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: MAP_WIDTH,
              height: 112,
              backgroundImage: "linear-gradient(180deg, rgba(28,25,23,0), rgba(28,25,23,0.644))",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          position: "absolute",
          left: 64,
          top: 48,
        }}
      >
        <img src={brandIcon} width={44} height={44} alt="" />
        <span
          style={{ fontSize: 26, fontWeight: 700, lineHeight: "32px", letterSpacing: "-0.02em" }}
        >
          Rail Radar
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "absolute",
          left: 64,
          top: 174,
          fontSize: 18,
          lineHeight: "24px",
          color: "#A8A29E",
        }}
      >
        {flag ? (
          <img src={svgDataUri(flag)} width={27} height={18} style={{ borderRadius: 3 }} alt="" />
        ) : null}
        {country ? <span>{COUNTRY_MAP[country]}</span> : null}
        {country ? (
          <div style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: "#666666" }} />
        ) : null}
        <span>{marker.label}</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "absolute",
          left: 60,
          top: 216,
          width: TITLE_WIDTH,
          height: TITLE_HEIGHT,
        }}
      >
        <div style={stationNameStyle(fontSize)}>{name}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 64,
          top: 433,
          fontSize: 23,
          lineHeight: "32px",
          color: "#A8A29E",
        }}
      >
        <span>Live departures, arrivals</span>
        <span>and platform information.</span>
      </div>

      {map ? (
        <img
          src={marker.src}
          width={44}
          height={44}
          style={{ position: "absolute", left: MAP_LEFT + MAP_WIDTH / 2 - 22, top: 294 }}
          alt=""
        />
      ) : null}

      <span
        style={{
          position: "absolute",
          left: 64,
          top: 558,
          fontFamily: "Geist Mono",
          fontSize: 16,
          lineHeight: "22px",
          color: "#999999",
        }}
      >
        railradar24.com
      </span>
      <span
        style={{
          position: "absolute",
          right: 64,
          top: 560,
          fontFamily: "Geist Mono",
          fontSize: 14,
          lineHeight: "20px",
          color: "#999999",
        }}
      >
        {coords}
      </span>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      format: "webp",
      lossless: true,
      fonts,
      images: map ? [{ src: "station-map", data: map, cache: "none" }] : [],
    },
  );
}
