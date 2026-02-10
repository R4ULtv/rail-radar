import type { StationChange, ContributionStats } from "../types/contribution";

function generateGoogleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function generateRfiLink(stationId: string): string {
  return `https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor?placeId=${stationId}&arrivals=False`;
}

function getTypeBadge(type: StationChange["type"]): string {
  switch (type) {
    case "created":
      return "➕ Added";
    case "updated":
      return "🔄 Changed";
    case "deleted":
      return "➖ Removed";
  }
}

export function generatePRTitle(stats: ContributionStats): string {
  const parts: string[] = [];

  if (stats.coordinatesAdded > 0) {
    parts.push(
      `add ${stats.coordinatesAdded} coordinate${stats.coordinatesAdded !== 1 ? "s" : ""}`,
    );
  }

  if (stats.coordinatesUpdated > 0) {
    parts.push(
      `update ${stats.coordinatesUpdated} coordinate${stats.coordinatesUpdated !== 1 ? "s" : ""}`,
    );
  }

  if (stats.stationsRenamed > 0) {
    parts.push(
      `rename ${stats.stationsRenamed} station${stats.stationsRenamed !== 1 ? "s" : ""}`,
    );
  }

  if (stats.stationsCreated > 0) {
    parts.push(
      `create ${stats.stationsCreated} station${stats.stationsCreated !== 1 ? "s" : ""}`,
    );
  }

  if (stats.stationsDeleted > 0) {
    parts.push(
      `delete ${stats.stationsDeleted} station${stats.stationsDeleted !== 1 ? "s" : ""}`,
    );
  }

  if (parts.length === 0) {
    return "feat(data): update station data";
  }

  return `feat(data): ${parts.join(", ")}`;
}

interface FormattedChange {
  details: string;
  mapLink: string | null;
}

function formatChangeDescription(change: StationChange): FormattedChange {
  const { type, details } = change;

  if (type === "created") {
    if (details.newGeo) {
      return {
        details: `Created at (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`,
        mapLink: generateGoogleMapsLink(details.newGeo.lat, details.newGeo.lng),
      };
    }
    return { details: "Created", mapLink: null };
  }

  if (type === "deleted") {
    return { details: "Deleted", mapLink: null };
  }

  // Updated
  const updates: string[] = [];
  let mapLink: string | null = null;

  if (details.coordinatesAdded && details.newGeo) {
    updates.push(
      `Added coordinates (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`,
    );
    mapLink = generateGoogleMapsLink(details.newGeo.lat, details.newGeo.lng);
  } else if (details.coordinatesUpdated && details.newGeo) {
    updates.push(
      `Updated to (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`,
    );
    mapLink = generateGoogleMapsLink(details.newGeo.lat, details.newGeo.lng);
  }

  if (details.nameChanged && details.previousName && details.newName) {
    updates.push(`Renamed from "${details.previousName}"`);
  }

  if (details.typeChanged && details.previousType && details.newType) {
    updates.push(`Type changed from ${details.previousType} to ${details.newType}`);
  }

  if (details.importanceChanged && details.previousImportance !== undefined && details.newImportance !== undefined) {
    updates.push(`Importance changed from ${details.previousImportance} to ${details.newImportance}`);
  }

  return {
    details: updates.join(", ") || "Updated",
    mapLink,
  };
}

export function generatePRBody(
  changes: StationChange[],
  stats: ContributionStats,
): string {
  const lines: string[] = [];

  // Summary
  lines.push("## Summary");
  const summaryParts: string[] = [];

  if (stats.coordinatesAdded > 0) {
    summaryParts.push(
      `Added coordinates for ${stats.coordinatesAdded} station${stats.coordinatesAdded !== 1 ? "s" : ""}`,
    );
  }
  if (stats.coordinatesUpdated > 0) {
    summaryParts.push(
      `Updated coordinates for ${stats.coordinatesUpdated} station${stats.coordinatesUpdated !== 1 ? "s" : ""}`,
    );
  }
  if (stats.stationsRenamed > 0) {
    summaryParts.push(
      `Renamed ${stats.stationsRenamed} station${stats.stationsRenamed !== 1 ? "s" : ""}`,
    );
  }
  if (stats.stationsCreated > 0) {
    summaryParts.push(
      `Created ${stats.stationsCreated} new station${stats.stationsCreated !== 1 ? "s" : ""}`,
    );
  }
  if (stats.stationsDeleted > 0) {
    summaryParts.push(
      `Deleted ${stats.stationsDeleted} station${stats.stationsDeleted !== 1 ? "s" : ""}`,
    );
  }

  lines.push(summaryParts.join(". ") + ".");
  lines.push("");

  // Changes table
  lines.push("## Changes");
  lines.push("| Station | Type | Details | Map | RFI |");
  lines.push("|---------|------|---------|-----|-----|");

  for (const change of changes) {
    const { details, mapLink } = formatChangeDescription(change);
    const typeBadge = getTypeBadge(change.type);
    const mapCell = mapLink ? `[📍 View](${mapLink})` : "-";
    const rfiCell =
      change.type !== "deleted"
        ? `[🚉 Check](${generateRfiLink(change.id)})`
        : "-";
    lines.push(
      `| ${change.stationName} | ${typeBadge} | ${details} | ${mapCell} | ${rfiCell} |`,
    );
  }

  lines.push("");

  // Stats
  lines.push("## Stats");
  const coverageChange = stats.currentCoverage - stats.initialCoverage;
  const coverageChangeText =
    coverageChange > 0
      ? ` (+${coverageChange.toFixed(1)}%)`
      : coverageChange < 0
        ? ` (${coverageChange.toFixed(1)}%)`
        : "";

  lines.push(
    `- Coverage: ${stats.initialCoverage.toFixed(1)}% -> ${stats.currentCoverage.toFixed(1)}%${coverageChangeText}`,
  );
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("*Generated by Rail Radar Studio*");

  return lines.join("\n");
}

export function generateGitHubPRUrl(
  owner: string,
  repo: string,
  title: string,
  body: string,
  baseBranch = "main",
): string {
  const params = new URLSearchParams({
    title,
    body,
    base: baseBranch,
  });

  return `https://github.com/${owner}/${repo}/compare/${baseBranch}...HEAD?${params.toString()}`;
}
