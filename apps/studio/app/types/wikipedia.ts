// Wikipedia API response types

export interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
}

export interface WikipediaSearchResponse {
  query?: {
    search: WikipediaSearchResult[];
  };
}

export interface WikipediaPageRevision {
  slots?: {
    main?: {
      "*"?: string;
      content?: string;
    };
  };
  "*"?: string;
}

export interface WikipediaPage {
  pageid: number;
  title: string;
  revisions?: WikipediaPageRevision[];
}

export interface WikipediaContentResponse {
  query?: {
    pages: Record<string, WikipediaPage>;
  };
}

// Parsed station infobox data

export interface StationInfobox {
  /** Station status: attiva, soppressa, chiusa, etc. */
  stato?: string;
  /** Coordinates */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Wikipedia article URL */
  wikipediaUrl?: string;
}

export type StationStatus = "attiva" | "soppressa" | "chiusa" | "unknown";
