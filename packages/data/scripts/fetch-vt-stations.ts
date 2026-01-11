/**
 * Script to fetch all stations from ViaggiaTreno API
 * Run with: npx tsx scripts/fetch-vt-stations.ts
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";
const REGIONS = 22;

interface VTStationRaw {
  codiceStazione: string;
  lat: number;
  lon: number;
  localita: {
    nomeLungo: string;
  };
}

interface VTStation {
  id: string;
  name: string;
  geo: {
    lat: number;
    lng: number;
  };
}

async function fetchStationsForRegion(regionId: number): Promise<VTStation[]> {
  const url = `${BASE_URL}/elencoStazioni/${regionId}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`Failed to fetch region ${regionId}: ${response.status}`);
    return [];
  }

  const data: VTStationRaw[] = await response.json();

  return data
    .filter((s) => s.lat !== 0 && s.lon !== 0) // Filter out stations without coordinates
    .map((s) => ({
      id: s.codiceStazione,
      name: s.localita.nomeLungo,
      geo: {
        lat: s.lat,
        lng: s.lon,
      },
    }));
}

async function main() {
  console.log("Fetching stations from ViaggiaTreno API...");

  const allStations: VTStation[] = [];
  const seenIds = new Set<string>();

  for (let regionId = 1; regionId <= REGIONS; regionId++) {
    console.log(`Fetching region ${regionId}/${REGIONS}...`);
    const stations = await fetchStationsForRegion(regionId);

    for (const station of stations) {
      if (!seenIds.has(station.id)) {
        seenIds.add(station.id);
        allStations.push(station);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Sort by name
  allStations.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Total unique stations: ${allStations.length}`);

  const outputPath = join(__dirname, "../src/vt-stations.json");
  writeFileSync(outputPath, JSON.stringify(allStations, null, 2));

  console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);
