<script lang="ts">
    import type { Station } from "@repo/data";
    import { onMount } from "svelte";
    import ContributionPanel from "$lib/components/ContributionPanel.svelte";
    import CreateStationDialog from "$lib/components/CreateStationDialog.svelte";
    import HeaderBar from "$lib/components/HeaderBar.svelte";
    import StationEditPanel from "$lib/components/StationEditPanel.svelte";
    import StationMap from "$lib/components/StationMap.svelte";
    import StationSidebar from "$lib/components/StationSidebar.svelte";
    import StatusBar from "$lib/components/StatusBar.svelte";
    import UploadPrompt from "$lib/components/UploadPrompt.svelte";
    import { contributionStore } from "$lib/stores/contribution";
    import { historyStore, type HistoryOp } from "$lib/stores/history";
    import { stationStore } from "$lib/stores/stations";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const changedStationIdsStore = contributionStore.changedStationIds;
    const canUndoStore = historyStore.canUndo;
    const canRedoStore = historyStore.canRedo;
    const undoLabelStore = historyStore.nextUndoLabel;
    const redoLabelStore = historyStore.nextRedoLabel;

    let selectedStationId = $state<string | null>(null);
    let isAddingStation = $state(false);
    let isSaving = $state(false);
    let contributionPanelOpen = $state(false);
    let pendingNewStation = $state<{ lat: number; lng: number } | null>(null);
    let toastMessage = $state<string | null>(null);

    const stationState = $derived($stationStore);
    const selectedStation = $derived(
        selectedStationId
            ? (stationState.stations.find(
                  (station) => station.id === selectedStationId,
              ) ?? null)
            : null,
    );
    const existingIds = $derived(
        new Map(
            stationState.stations.map((station) => [station.id, station.name]),
        ),
    );
    const existingPrefixes = $derived(
        new Set(
            stationState.stations
                .map((station) => station.id.match(/^[A-Z]+/)?.[0])
                .filter((prefix): prefix is string => Boolean(prefix)),
        ),
    );

    onMount(() => {
        contributionStore.hydrate();
        historyStore.hydrate();
        void stationStore.initialize({ mode: data.mode });

        function onKeydown(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            const inField =
                target?.tagName === "INPUT" ||
                target?.tagName === "TEXTAREA" ||
                target?.isContentEditable;

            if (event.key === "Escape" && !inField) {
                selectedStationId = null;
                isAddingStation = false;
                return;
            }

            const meta = event.metaKey || event.ctrlKey;
            if (!meta || inField) return;
            const key = event.key.toLowerCase();

            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                void handleUndo();
            } else if ((key === "z" && event.shiftKey) || key === "y") {
                event.preventDefault();
                void handleRedo();
            }
        }

        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    });

    function stationsEqual(a: Station, b: Station): boolean {
        return (
            a.id === b.id &&
            a.name === b.name &&
            a.type === b.type &&
            a.importance === b.importance &&
            a.geo?.lat === b.geo?.lat &&
            a.geo?.lng === b.geo?.lng
        );
    }

    function reconcileContribution(stationId: string) {
        const baseline = historyStore.getBaseline(stationId);
        const current =
            stationState.stations.find((station) => station.id === stationId) ??
            null;

        if (!baseline.has) {
            contributionStore.removeChange(stationId);
            return;
        }

        if (baseline.value === null) {
            if (current) contributionStore.recordChange("created", current);
            else contributionStore.removeChange(stationId);
            return;
        }

        if (!current) {
            contributionStore.recordChange("deleted", baseline.value);
            return;
        }

        if (stationsEqual(baseline.value, current)) {
            contributionStore.removeChange(stationId);
        } else {
            contributionStore.recordChange("updated", current, baseline.value);
        }
    }

    function showToast(message: string) {
        toastMessage = message;
        window.setTimeout(() => {
            if (toastMessage === message) toastMessage = null;
        }, 2200);
    }

    function handleSelectStation(id: string) {
        selectedStationId = id;
        isAddingStation = false;
    }

    function handleAddStationClick() {
        isAddingStation = !isAddingStation;
        selectedStationId = null;
    }

    async function handleImportFile(file: File) {
        await stationStore.loadUploadedFile(file);
        historyStore.clear();
        selectedStationId = null;
        isAddingStation = false;
        showToast(`Imported ${file.name}`);
    }

    async function handleMapClick(lat: number, lng: number) {
        if (!isAddingStation) return;
        pendingNewStation = { lat, lng };
    }

    async function handleConfirmCreate(id: string, name: string) {
        if (!pendingNewStation) return;
        const { lat, lng } = pendingNewStation;
        pendingNewStation = null;

        try {
            isSaving = true;
            const station = await stationStore.createStation(
                name,
                { lat, lng },
                { id },
            );
            historyStore.push({ kind: "create", station });
            reconcileContribution(station.id);
            selectedStationId = station.id;
            isAddingStation = false;
            showToast("Station created");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to create station",
            );
        } finally {
            isSaving = false;
        }
    }

    function handleCancelCreate() {
        pendingNewStation = null;
    }

    async function handleMarkerDragEnd(id: string, lat: number, lng: number) {
        const previousStation = stationState.stations.find(
            (station) => station.id === id,
        );
        if (!previousStation) return;

        try {
            const updated = await stationStore.updateStation(id, {
                geo: { lat, lng },
            });
            historyStore.push({
                kind: "update",
                before: previousStation,
                after: updated,
            });
            reconcileContribution(updated.id);
            showToast("Position updated");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to update position",
            );
        }
    }

    async function handleSetStationLocation(lat: number, lng: number) {
        if (!selectedStation) return;
        const previousStation: Station = { ...selectedStation };

        try {
            const updated = await stationStore.updateStation(
                selectedStation.id,
                { geo: { lat, lng } },
            );
            historyStore.push({
                kind: "update",
                before: previousStation,
                after: updated,
            });
            reconcileContribution(updated.id);
            showToast(`Location set for ${selectedStation.name}`);
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to set location",
            );
        }
    }

    async function handleSave(updates: {
        name: string;
        geo: { lat: number; lng: number };
        type: "rail" | "metro" | "light";
        importance: 1 | 2 | 3 | 4;
    }) {
        if (!selectedStationId) return;
        const previousStation = stationState.stations.find(
            (station) => station.id === selectedStationId,
        );
        if (!previousStation) return;

        try {
            isSaving = true;
            const updated = await stationStore.updateStation(
                selectedStationId,
                updates,
            );
            historyStore.push({
                kind: "update",
                before: previousStation,
                after: updated,
            });
            reconcileContribution(updated.id);
            showToast("Station updated");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to update station",
            );
        } finally {
            isSaving = false;
        }
    }

    async function applyOp(op: HistoryOp, direction: "undo" | "redo") {
        let stationId: string;
        if (op.kind === "create") {
            stationId = op.station.id;
            if (direction === "undo") {
                await stationStore.deleteStation(op.station.id);
                if (selectedStationId === op.station.id)
                    selectedStationId = null;
            } else {
                await stationStore.restoreStation(op.station);
            }
        } else if (op.kind === "delete") {
            stationId = op.station.id;
            if (direction === "undo") {
                await stationStore.restoreStation(op.station);
            } else {
                await stationStore.deleteStation(op.station.id);
                if (selectedStationId === op.station.id)
                    selectedStationId = null;
            }
        } else {
            const target = direction === "undo" ? op.before : op.after;
            stationId = target.id;
            await stationStore.updateStation(target.id, {
                name: target.name,
                geo: target.geo,
                type: target.type,
                importance: target.importance,
            });
        }
        reconcileContribution(stationId);
    }

    async function handleUndo() {
        const op = historyStore.popPast();
        if (!op) return;
        try {
            await applyOp(op, "undo");
            showToast(`Undid ${describeOp(op)}`);
        } catch (error) {
            historyStore.popFuture();
            showToast(
                error instanceof Error ? error.message : "Failed to undo",
            );
        }
    }

    async function handleRedo() {
        const op = historyStore.popFuture();
        if (!op) return;
        try {
            await applyOp(op, "redo");
            showToast(`Redid ${describeOp(op)}`);
        } catch (error) {
            historyStore.popPast();
            showToast(
                error instanceof Error ? error.message : "Failed to redo",
            );
        }
    }

    function describeOp(op: HistoryOp): string {
        if (op.kind === "create") return `create ${op.station.name}`;
        if (op.kind === "delete") return `delete ${op.station.name}`;
        return `edit ${op.after.name}`;
    }

    async function handleDelete() {
        if (!selectedStationId) return;
        const station = stationState.stations.find(
            (item) => item.id === selectedStationId,
        );
        if (!station) return;

        try {
            isSaving = true;
            const deleted = await stationStore.deleteStation(selectedStationId);
            historyStore.push({ kind: "delete", station: deleted });
            reconcileContribution(deleted.id);
            selectedStationId = null;
            showToast("Station deleted");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to delete station",
            );
        } finally {
            isSaving = false;
        }
    }
</script>

{#if stationState.isLoading}
    <main class="flex h-screen items-center justify-center">
        Loading stations...
    </main>
{:else if stationState.mode === "local" && stationState.error}
    <main
        class="flex h-screen items-center justify-center bg-background px-6 text-foreground"
    >
        <div
            class="max-w-md border border-border bg-card p-6 text-sm shadow-xl"
        >
            <h1 class="text-base font-semibold">
                Local station file unavailable
            </h1>
            <p class="mt-2 text-muted-foreground">{stationState.error}</p>
            <p class="mt-4 text-xs text-muted-foreground">
                Local mode needs <code>PUBLIC_STUDIO_LOCAL_MODE=true</code> and
                server file access to
                <code>packages/data/src/stations.geojson</code>.
            </p>
        </div>
    </main>
{:else if stationState.mode === "browser" && stationState.stations.length === 0}
    <UploadPrompt error={stationState.error} />
{:else}
    <main class="flex h-screen flex-col overflow-hidden">
        <HeaderBar
            fileName={stationState.fileName}
            mode={stationState.mode}
            modifiedCount={$changedStationIdsStore.size}
            {isAddingStation}
            canExport={stationState.stations.length > 0}
            onImportFile={handleImportFile}
            onExportClick={() => stationStore.exportGeojson()}
            onAddStationClick={handleAddStationClick}
            onReviewClick={() => (contributionPanelOpen = true)}
            canUndo={$canUndoStore}
            canRedo={$canRedoStore}
            undoLabel={$undoLabelStore}
            redoLabel={$redoLabelStore}
            onUndo={handleUndo}
            onRedo={handleRedo}
        />

        <div class="flex min-h-0 flex-1">
            <StationSidebar
                stations={stationState.stations}
                {selectedStationId}
                changedStationIds={$changedStationIdsStore}
                onSelectStation={handleSelectStation}
            />

            <div class="relative flex min-w-0 flex-1">
                <div class="min-w-0 flex-1">
                    <StationMap
                        stations={stationState.stations}
                        {selectedStationId}
                        {isAddingStation}
                        onSelectStation={handleSelectStation}
                        onMarkerDragEnd={handleMarkerDragEnd}
                        onMapClick={handleMapClick}
                        onSetStationLocation={handleSetStationLocation}
                    />
                </div>

                {#if selectedStation}
                    <StationEditPanel
                        station={selectedStation}
                        {isSaving}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onClose={() => (selectedStationId = null)}
                    />
                {/if}

                {#if toastMessage}
                    <div
                        class="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-none border border-border bg-card px-4 py-2 text-sm shadow-xl"
                    >
                        {toastMessage}
                    </div>
                {/if}
            </div>
        </div>

        <StatusBar
            stations={stationState.stations}
            {selectedStation}
            modifiedCount={$changedStationIdsStore.size}
            fileName={stationState.fileName}
            {isAddingStation}
        />

        <ContributionPanel
            open={contributionPanelOpen}
            onOpenChange={(open) => (contributionPanelOpen = open)}
        />

        <CreateStationDialog
            open={pendingNewStation !== null}
            {existingIds}
            {existingPrefixes}
            onConfirm={handleConfirmCreate}
            onCancel={handleCancelCreate}
        />
    </main>
{/if}
