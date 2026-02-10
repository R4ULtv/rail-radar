"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useStations } from "./hooks/use-stations";
import { StationSidebar } from "./components/station-sidebar";
import { StationMap } from "./components/station-map";
import { StationEditPanel } from "./components/station-edit-panel";
import {
  ContributionProvider,
  useContribution,
} from "./contexts/contribution-context";
import { ContributionBanner } from "./components/contribution-banner";
import { ContributionPanel } from "./components/contribution-panel";

function StudioContent() {
  const { stations, isLoading, createStation, updateStation, deleteStation } =
    useStations();
  const { recordChange, changedStationIds } = useContribution();

  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contributionPanelOpen, setContributionPanelOpen] = useState(false);

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const handleSelectStation = useCallback((id: string) => {
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
        recordChange("created", station);
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
    [isAddingStation, createStation, recordChange],
  );

  const handleMarkerDragEnd = useCallback(
    async (id: string, lat: number, lng: number) => {
      const previousStation = stations.find((s) => s.id === id);
      if (!previousStation) return;

      try {
        const updated = await updateStation(id, { geo: { lat, lng } });
        recordChange("updated", updated, previousStation);
        toast.success("Position updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update position",
        );
      }
    },
    [updateStation, stations, recordChange],
  );

  const handleSetStationLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!selectedStation) return;

      const previousStation = { ...selectedStation };

      try {
        const updated = await updateStation(selectedStation.id, {
          geo: { lat, lng },
        });
        recordChange("updated", updated, previousStation);
        toast.success(`Location set for ${selectedStation.name}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to set location",
        );
      }
    },
    [selectedStation, updateStation, recordChange],
  );

  const handleSave = useCallback(
    async (updates: {
      name: string;
      geo: { lat: number; lng: number } | null;
      type: "rail" | "metro";
      importance: 1 | 2 | 3 | 4;
    }) => {
      if (!selectedStationId) return;

      const previousStation = stations.find((s) => s.id === selectedStationId);
      if (!previousStation) return;

      try {
        setIsSaving(true);
        const updated = await updateStation(selectedStationId, updates);
        recordChange("updated", updated, previousStation);
        toast.success("Station updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update station",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [selectedStationId, updateStation, stations, recordChange],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedStationId) return;

    const station = stations.find((s) => s.id === selectedStationId);
    if (!station) return;

    try {
      setIsSaving(true);
      await deleteStation(selectedStationId!);
      recordChange("deleted", station);
      setSelectedStationId(null);
      toast.success("Station deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete station",
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedStationId, deleteStation, stations, recordChange]);

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
        changedStationIds={changedStationIds}
        onSelectStation={handleSelectStation}
        onAddStationClick={handleAddStationClick}
        contributionBanner={
          <ContributionBanner
            onReviewClick={() => setContributionPanelOpen(true)}
          />
        }
      />
      <div className="relative flex-1">
        <StationMap
          stations={stations}
          selectedStationId={selectedStationId}
          isAddingStation={isAddingStation}
          onSelectStation={handleSelectStation}
          onMarkerDragEnd={handleMarkerDragEnd}
          onMapClick={handleMapClick}
          onSetStationLocation={handleSetStationLocation}
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
      <ContributionPanel
        open={contributionPanelOpen}
        onOpenChange={setContributionPanelOpen}
      />
    </main>
  );
}

export default function Home() {
  const { stations, isLoading } = useStations();

  if (isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-background text-foreground">
        Loading stations...
      </main>
    );
  }

  return (
    <ContributionProvider stations={stations}>
      <StudioContent />
    </ContributionProvider>
  );
}
