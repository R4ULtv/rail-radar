"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayersIcon,
  TrainFrontTunnelIcon,
  TrainTrackIcon,
  SquareMIcon,
  TramFrontIcon,
  TrainFrontIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import type {
  LayerType,
  LayerVisibility,
  StationType,
  StationVisibility,
} from "@/hooks/use-map-layers";

const STATION_OPTIONS: { type: StationType; label: string; icon: LucideIcon }[] = [
  { type: "rail", label: "Rail", icon: TrainFrontIcon },
  { type: "light", label: "Light Rail", icon: TramFrontIcon },
  { type: "metro", label: "Metro", icon: SquareMIcon },
];

const LAYER_OPTIONS: { type: LayerType; label: string; icon: LucideIcon }[] = [
  { type: "railwaySurface", label: "Surface", icon: TrainTrackIcon },
  { type: "railwayTunnels", label: "Underground", icon: TrainFrontTunnelIcon },
];

function FilterContent({
  stations,
  layers,
  onToggleStation,
  onToggleLayer,
}: {
  stations: StationVisibility;
  layers: LayerVisibility;
  onToggleStation: (type: StationType) => void;
  onToggleLayer: (type: LayerType) => void;
}) {
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground mb-1">Stations</p>
      {STATION_OPTIONS.map(({ type, label, icon: Icon }) => (
        <label
          key={type}
          className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-muted -mx-1.5 px-1.5 rounded-sm"
        >
          <Checkbox checked={stations[type]} onCheckedChange={() => onToggleStation(type)} />
          <span className="text-sm flex-1">{label}</span>
          <Icon className="size-4 text-muted-foreground shrink-0" />
        </label>
      ))}
      <div className="border-t border-border my-1.5" />
      <p className="text-xs font-medium text-muted-foreground mb-1">Layers</p>
      {LAYER_OPTIONS.map(({ type, label, icon: Icon }) => (
        <label
          key={type}
          className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-muted -mx-1.5 px-1.5 rounded-sm"
        >
          <Checkbox checked={layers[type]} onCheckedChange={() => onToggleLayer(type)} />
          <span className="text-sm flex-1">{label}</span>
          <Icon className="size-4 text-muted-foreground shrink-0" />
        </label>
      ))}
    </>
  );
}

export function MapLayerFilter({
  stations,
  layers,
  onToggleStation,
  onToggleLayer,
}: {
  stations: StationVisibility;
  layers: LayerVisibility;
  onToggleStation: (type: StationType) => void;
  onToggleLayer: (type: LayerType) => void;
}) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const triggerButton = (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Map layers"
      className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-10 md:size-8 active:scale-[0.98]"
      onClick={isMobile ? () => setDrawerOpen(true) : undefined}
    >
      <LayersIcon />
    </Button>
  );

  if (isMobile) {
    return (
      <div className="absolute top-4 right-4">
        {triggerButton}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="bg-card">
            <DrawerHeader>
              <DrawerTitle>Map Layers</DrawerTitle>
              <DrawerDescription>Toggle station types and map layers</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <FilterContent
                stations={stations}
                layers={layers}
                onToggleStation={onToggleStation}
                onToggleLayer={onToggleLayer}
              />
            </div>
            <div className="px-4 pb-6">
              <DrawerClose render={<Button variant="default" className="w-full" />}>
                Done
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4">
      <Popover>
        <PopoverTrigger render={triggerButton} />
        <PopoverContent side="bottom" align="end" sideOffset={8} className="w-48 gap-1 p-3">
          <FilterContent
            stations={stations}
            layers={layers}
            onToggleStation={onToggleStation}
            onToggleLayer={onToggleLayer}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
