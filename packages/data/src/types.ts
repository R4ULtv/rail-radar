export interface Station {
  id: string;
  name: string;
  type: "rail" | "metro";
  geo?: {
    lat: number;
    lng: number;
  };
}

export interface Train {
  brand: string | null;
  category: string | null;
  trainNumber: string;
  origin?: string;
  destination?: string;
  scheduledTime: string;
  delay: number | null;
  platform: string | null;
  status: "incoming" | "departing" | "cancelled" | null;
  info: string | null;
}
