import type { LngLatBounds } from "@yandex/ymaps3-types";
import type { BBox } from "../services/MapService";

/** Grid cell size (meters) for the heatmap depending on the map zoom. */
export function cellSizeForZoom(zoom: number): number {
    if (zoom <= 12) {
        return 1000;
    }
    if (zoom <= 14) {
        return 500;
    }
    return 250;
}

/**
 * Five-step sequential scale used for the heatmap fill and its legend.
 *
 * The light ramp climbs from a pale wash to a deep red: over paper, "more" means
 * "darker". Over a night basemap that direction is exactly wrong -- the palest step
 * would be the brightest thing on the screen, standing for the smallest number the
 * ramp can show -- so the dark ramp climbs the other way, out of the ground towards
 * an ember, and keeps its hue off the ground's own: warm data over neutral graphite.
 *
 * Every function below takes the ramp as an argument, so neither theme is baked
 * into the arithmetic.
 */
export const HEAT_COLORS: readonly string[] = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];

export const HEAT_COLORS_DARK: readonly string[] = ["#3b2426", "#6b2f31", "#9d3b34", "#d15f33", "#ffab3d"];

/** The heat ramp for a theme. Takes a plain string so this module stays pure. */
export function heatColors(theme: "light" | "dark"): readonly string[] {
    return theme === "dark" ? HEAT_COLORS_DARK : HEAT_COLORS;
}

/**
 * Upper bounds (inclusive) of the legend steps for the given maximum count.
 * The last step always ends at `max`; for small maxima the steps collapse to unique integers.
 */
export function heatThresholds(max: number, steps: number = HEAT_COLORS.length): number[] {
    const safeMax = Math.max(1, Math.floor(max));
    const result: number[] = [];
    for (let i = 1; i <= steps; i++) {
        result.push(Math.max(i, Math.ceil((safeMax * i) / steps)));
    }
    result[steps - 1] = Math.max(safeMax, steps);
    return result;
}

/** Index of the color step (0..steps-1) for a cell with `count` marks when the maximum is `max`. */
export function heatStep(count: number, max: number, steps: number = HEAT_COLORS.length): number {
    if (count <= 0) {
        return 0;
    }
    const thresholds = heatThresholds(max, steps);
    const index = thresholds.findIndex((t) => count <= t);
    return index === -1 ? steps - 1 : index;
}

/** Fill color for a heatmap cell, on the given ramp. */
export function heatColor(count: number, max: number, colors: readonly string[] = HEAT_COLORS): string {
    return colors[heatStep(count, max, colors.length)];
}

/** Human-readable label of one legend step: `1`, `2–4`, `5+`. */
export function heatLegend(max: number, colors: readonly string[] = HEAT_COLORS): { color: string; label: string }[] {
    const thresholds = heatThresholds(max, colors.length);
    return colors.map((color, i) => {
        const from = i === 0 ? 1 : thresholds[i - 1] + 1;
        const to = thresholds[i];
        let label: string;
        if (i === colors.length - 1) {
            label = `${from}+`;
        } else if (from >= to) {
            label = `${to}`;
        } else {
            label = `${from}–${to}`;
        }
        return { color, label };
    });
}

/** Converts ymaps3 bounds (`[[lon, lat], [lon, lat]]`, any corner order) into `[minLon, minLat, maxLon, maxLat]`. */
export function bboxFromBounds(bounds: LngLatBounds): BBox {
    const [[lon1, lat1], [lon2, lat2]] = bounds;
    return [Math.min(lon1, lon2), Math.min(lat1, lat2), Math.max(lon1, lon2), Math.max(lat1, lat2)];
}

/** Stable key of a heatmap request, used to skip refetching the same view. */
export function heatmapKey(bbox: BBox, cellM: number, typeIds: number[], statusIds: number[]): string {
    return `${bbox.map((v) => v.toFixed(4)).join(",")}|${cellM}|${[...typeIds].sort((a, b) => a - b).join(",")}|${[...statusIds].sort((a, b) => a - b).join(",")}`;
}
