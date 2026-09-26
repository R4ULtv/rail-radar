export const websiteUrl = "https://www.railradar24.com";
export const privacyPolicyUrl = `${websiteUrl}/privacy-policy`;
export const termsOfServiceUrl = `${websiteUrl}/terms-of-service`;
export const contactUrl = "mailto:contact@railradar24.com";

export const sourceCodeUrl = "https://github.com/R4ULtv/rail-radar";
const issuesUrl = `${sourceCodeUrl}/issues/new`;

export const bugReportUrl = `${issuesUrl}?template=bug_report.yml`;
export const featureRequestUrl = `${issuesUrl}?template=feature_request.yml`;

// Credits for the map, which Mapbox's terms require wherever the map is shown.
export const mapboxUrl = "https://www.mapbox.com/about/maps/";
export const mapboxPrivacyPolicyUrl = "https://www.mapbox.com/legal/privacy";
export const openStreetMapUrl = "https://www.openstreetmap.org/copyright";

/** Where the map is, so a mistake can be reported at the right spot. */
export interface MapPosition {
  center: [longitude: number, latitude: number];
  zoom: number;
}

/** Mapbox's "Improve this map" feedback, opened on the part of the map the user was looking at. */
export function mapFeedbackUrl({ center: [longitude, latitude], zoom }: MapPosition) {
  return `https://apps.mapbox.com/feedback/#/${longitude.toFixed(5)}/${latitude.toFixed(5)}/${zoom.toFixed(2)}`;
}
