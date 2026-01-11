export interface VTStation {
  id: string; // e.g., "S01700"
  name: string;
  geo: {
    lat: number;
    lng: number;
  };
}

export interface VTTrain {
  trainNumber: string;
  category: string | null; // FR, FB, IC, EC, REG, etc.
  brand: string | null; // Frecciarossa, Frecciabianca, etc.
  origin?: string;
  destination?: string;
  scheduledTime: string;
  delay: number | null;
  platform: string | null;
  status: "incoming" | "departing" | "cancelled" | null;
}

// Raw response from viaggiatreno API
export interface VTRawTrain {
  numeroTreno: number;
  categoriaDescrizione: string;
  origine: string | null;
  destinazione: string | null;
  compOrarioPartenza: string | null;
  compOrarioArrivo: string | null;
  ritardo: number;
  binarioEffettivoPartenzaCodice: string | null;
  binarioEffettivoArrivoCodice: string | null;
  binarioProgrammatoPartenzaCodice: string | null;
  binarioProgrammatoArrivoCodice: string | null;
  inStazione: boolean;
  nonPartito: boolean;
  circolante: boolean;
}
