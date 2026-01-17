"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useStations } from "./hooks/use-stations";
import { StationSidebar } from "./components/station-sidebar";
import { StationMap } from "./components/station-map";
import { StationEditPanel } from "./components/station-edit-panel";

export default function Home() {
  const { stations, isLoading, createStation, updateStation, deleteStation } =
    useStations();

  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    null,
  );
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const handleSelectStation = useCallback((id: number) => {
    setSelectedStationId(id);
    setIsAddingStation(false);
  }, []);

  const handleAddStationClick = useCallback(() => {
    setIsAddingStation((prev) => !prev);
    setSelectedStationId(null);
  }, []);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!isAddingStation) return;

      const name = `New Station`;
      try {
        setIsSaving(true);
        const station = await createStation(name, { lat, lng });
        setSelectedStationId(station.id);
        setIsAddingStation(false);
        toast.success("Station created");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create station",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [isAddingStation, createStation],
  );

  const handleMarkerDragEnd = useCallback(
    async (id: number, lat: number, lng: number) => {
      try {
        await updateStation(id, { geo: { lat, lng } });
        toast.success("Position updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update position",
        );
      }
    },
    [updateStation],
  );

  const handleSave = useCallback(
    async (updates: { name: string; geo?: { lat: number; lng: number } }) => {
      if (!selectedStationId) return;

      try {
        setIsSaving(true);
        await updateStation(selectedStationId, updates);
        toast.success("Station updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update station",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [selectedStationId, updateStation],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedStationId) return;

    try {
      setIsSaving(true);
      await deleteStation(selectedStationId);
      setSelectedStationId(null);
      toast.success("Station deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete station",
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedStationId, deleteStation]);

  const handleCloseEditPanel = useCallback(() => {
    setSelectedStationId(null);
  }, []);

  if (isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-background text-foreground">
        Loading stations...
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      <StationSidebar
        stations={stations}
        selectedStationId={selectedStationId}
        isAddingStation={isAddingStation}
        onSelectStation={handleSelectStation}
        onAddStationClick={handleAddStationClick}
      />
      <div className="relative flex-1">
        <StationMap
          stations={stations}
          selectedStationId={selectedStationId}
          isAddingStation={isAddingStation}
          onSelectStation={handleSelectStation}
          onMarkerDragEnd={handleMarkerDragEnd}
          onMapClick={handleMapClick}
        />
        {selectedStation && (
          <div className="absolute left-4 top-4 z-10">
            <StationEditPanel
              station={selectedStation}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={handleCloseEditPanel}
              isSaving={isSaving}
            />
          </div>
        )}
      </div>
    </main>
  );
}
