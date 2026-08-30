import { describe, expect, it } from "vitest";
import { HEAT_COLORS, bboxFromBounds, cellSizeForZoom, heatColor, heatLegend, heatStep, heatThresholds, heatmapKey } from "./heatmap";

describe("cellSizeForZoom", () => {
    it("maps zoom to the grid cell size", () => {
        expect(cellSizeForZoom(11)).toBe(1000);
        expect(cellSizeForZoom(12)).toBe(1000);
        expect(cellSizeForZoom(13)).toBe(500);
        expect(cellSizeForZoom(14)).toBe(500);
        expect(cellSizeForZoom(14.9)).toBe(250);
        expect(cellSizeForZoom(15)).toBe(250);
        expect(cellSizeForZoom(22)).toBe(250);
    });
});

describe("heat color scale", () => {
    it("has five steps", () => {
        expect(HEAT_COLORS).toHaveLength(5);
        expect(heatLegend(100)).toHaveLength(5);
    });

    it("splits the range evenly and clamps at both ends", () => {
        expect(heatThresholds(100)).toEqual([20, 40, 60, 80, 100]);
        expect(heatStep(1, 100)).toBe(0);
        expect(heatStep(20, 100)).toBe(0);
        expect(heatStep(21, 100)).toBe(1);
        expect(heatStep(100, 100)).toBe(4);
        expect(heatStep(1000, 100)).toBe(4);
        expect(heatStep(0, 100)).toBe(0);
    });

    it("keeps unique integer thresholds for small maxima", () => {
        expect(heatThresholds(1)).toEqual([1, 2, 3, 4, 5]);
        expect(heatThresholds(3)).toEqual([1, 2, 3, 4, 5]);
        expect(heatColor(1, 1)).toBe(HEAT_COLORS[0]);
        expect(heatColor(5, 3)).toBe(HEAT_COLORS[4]);
    });

    it("builds legend labels as ranges", () => {
        expect(heatLegend(100).map((s) => s.label)).toEqual(["1–20", "21–40", "41–60", "61–80", "81+"]);
        expect(heatLegend(3).map((s) => s.label)).toEqual(["1", "2", "3", "4", "5+"]);
    });
});

describe("bboxFromBounds", () => {
    it("normalizes corner order to [minLon, minLat, maxLon, maxLat]", () => {
        expect(bboxFromBounds([[41.5, 52.8], [41.2, 52.6]])).toEqual([41.2, 52.6, 41.5, 52.8]);
        expect(bboxFromBounds([[41.2, 52.6], [41.5, 52.8]])).toEqual([41.2, 52.6, 41.5, 52.8]);
    });
});

describe("heatmapKey", () => {
    it("is order-insensitive for filter ids and rounds the bbox", () => {
        const a = heatmapKey([41.20001, 52.6, 41.5, 52.8], 500, [2, 1], [3]);
        const b = heatmapKey([41.20002, 52.6, 41.5, 52.8], 500, [1, 2], [3]);
        expect(a).toBe(b);
        expect(heatmapKey([41.2, 52.6, 41.5, 52.8], 250, [1], [3])).not.toBe(a);
    });
});
