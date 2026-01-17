"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import type { Station } from "@repo/data";

interface StationEditPanelProps {
  station: Station;
  onSave: (updates: {
    name: string;
    geo?: { lat: number; lng: number };
  }) => void;
  onDelete: () => void;
  onClose: () => void;
  isSaving: boolean;
}

export function StationEditPanel({
  station,
  onSave,
  onDelete,
  onClose,
  isSaving,
}: StationEditPanelProps) {
  const [name, setName] = useState(station.name);
  const [lat, setLat] = useState(station.geo?.lat?.toString() ?? "");
  const [lng, setLng] = useState(station.geo?.lng?.toString() ?? "");

  // Reset form when station changes
  useEffect(() => {
    setName(station.name);
    setLat(station.geo?.lat?.toString() ?? "");
    setLng(station.geo?.lng?.toString() ?? "");
  }, [station]);

  const handleSave = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    const geo =
      !isNaN(parsedLat) && !isNaN(parsedLng)
        ? { lat: parsedLat, lng: parsedLng }
        : undefined;

    onSave({ name, geo });
  };

  const hasChanges =
    name !== station.name ||
    lat !== (station.geo?.lat?.toString() ?? "") ||
    lng !== (station.geo?.lng?.toString() ?? "");

  return (
    <div className="rounded-lg border bg-card p-4 shadow-lg">
      <div className="mb-4 border-b pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Station</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Update station details and coordinates
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <p className="text-xs text-muted-foreground">
            Display name shown in the app
          </p>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Station name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <p className="text-xs text-muted-foreground">
              North-south position (-90 to 90)
            </p>
            <Input
              id="lat"
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="41.901"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lng">Longitude</Label>
            <p className="text-xs text-muted-foreground">
              East-west position (-180 to 180)
            </p>
            <Input
              id="lng"
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="12.501"
            />
          </div>
        </div>

        {lat && lng && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLinkIcon className="size-4" />
            View on Google Maps
          </a>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving || !hasChanges}
            className="flex-1"
          >
            <SaveIcon className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isSaving}>
            <Trash2Icon className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
