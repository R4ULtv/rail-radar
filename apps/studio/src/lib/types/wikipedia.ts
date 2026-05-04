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

export interface StationInfobox {
  stato?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  wikipediaUrl?: string;
}

export type StationStatus = "attiva" | "soppressa" | "chiusa" | "unknown";
