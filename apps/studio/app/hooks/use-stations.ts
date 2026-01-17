import useSWR from "swr";
import type { Station } from "@repo/data";

const API_URL = "/api/stations";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useStations() {
  const { data, error, isLoading, mutate } = useSWR<Station[]>(
    API_URL,
    fetcher,
  );

  const createStation = async (
    name: string,
    geo?: { lat: number; lng: number },
  ): Promise<Station> => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, geo }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create station");
    }

    const newStation = await response.json();

    // Optimistic update
    mutate(
      (current) =>
        current
          ? [...current, newStation].sort((a, b) =>
              a.name.localeCompare(b.name),
            )
          : [newStation],
      { revalidate: false },
    );

    return newStation;
  };

  const updateStation = async (
    id: number,
    updates: { name?: string; geo?: { lat: number; lng: number } | null },
  ): Promise<Station> => {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update station");
    }

    const updatedStation = await response.json();

    // Optimistic update
    mutate(
      (current) =>
        current
          ? current
              .map((s) => (s.id === id ? updatedStation : s))
              .sort((a, b) => a.name.localeCompare(b.name))
          : current,
      { revalidate: false },
    );

    return updatedStation;
  };

  const deleteStation = async (id: number): Promise<Station> => {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete station");
    }

    const deletedStation = await response.json();

    // Optimistic update
    mutate(
      (current) => (current ? current.filter((s) => s.id !== id) : current),
      { revalidate: false },
    );

    return deletedStation;
  };

  return {
    stations: data ?? [],
    isLoading,
    error,
    mutate,
    createStation,
    updateStation,
    deleteStation,
  };
}
