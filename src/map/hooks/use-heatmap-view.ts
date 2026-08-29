import { useCallback, useEffect, useRef } from "react";
import type { MapEventUpdateHandler } from "@yandex/ymaps3-types";

import { bboxFromBounds, cellSizeForZoom } from "../../utils/heatmap";
import type { BBox } from "../../services/MapService";
import heatmapStore from "../../store/heatmap";
import { HEATMAP_DEBOUNCE_MS } from "../map-constants";

/** The map's own location object, as the update listener receives it. */
export type MapUpdateLocation = Parameters<MapEventUpdateHandler>[0]["location"];

/**
 * Keeps the heatmap in step with what the map is looking at.
 *
 * The cells are computed by the backend for a bbox and a cell size, so every pan and
 * zoom invalidates them; the reload is debounced, because a single drag produces one
 * update per frame. Toggling the layer on, or changing the mark filters, reloads
 * immediately instead -- there is nothing on screen to keep steady in that case.
 */
export function useHeatmapView(filtersQuery: string): { onUpdateView: (location: MapUpdateLocation) => void } {
    const viewRef = useRef<{ bbox: BBox; cellM: number } | null>(null);
    const heatmapTimer = useRef<number | undefined>(undefined);

    const scheduleHeatmap = useCallback((immediate: boolean = false) => {
        window.clearTimeout(heatmapTimer.current);
        const run = () => {
            const view = viewRef.current;
            if (view && heatmapStore.enabled) {
                heatmapStore.fetch(view.bbox, view.cellM);
            }
        };
        if (immediate) {
            run();
        } else {
            heatmapTimer.current = window.setTimeout(run, HEATMAP_DEBOUNCE_MS);
        }
    }, []);
    useEffect(() => () => window.clearTimeout(heatmapTimer.current), []);

    const onUpdateView = useCallback((location: MapUpdateLocation) => {
        if (location.bounds) {
            viewRef.current = { bbox: bboxFromBounds(location.bounds), cellM: cellSizeForZoom(location.zoom) };
            scheduleHeatmap();
        }
    }, [scheduleHeatmap]);

    const heatmapEnabled = heatmapStore.enabled;
    useEffect(() => {
        if (heatmapEnabled) {
            scheduleHeatmap(true);
        }
    }, [heatmapEnabled, filtersQuery, scheduleHeatmap]);

    return { onUpdateView };
}
