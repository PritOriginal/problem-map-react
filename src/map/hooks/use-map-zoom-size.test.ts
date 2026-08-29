import { describe, expect, it } from "vitest";

import { markerSizeForZoom } from "./use-map-zoom-size";
import { ZOOMS, ZOOM_RANGE } from "../map-constants";
import { MarkerSize } from "../../components/mark/mark";

describe("markerSizeForZoom", () => {
    it("is small at every zoom the map can start at, up to the first threshold", () => {
        expect(markerSizeForZoom(ZOOM_RANGE.min)).toBe(MarkerSize.small);
        expect(markerSizeForZoom(ZOOMS.small - 1)).toBe(MarkerSize.small);
        // the threshold itself still counts as the smaller size
        expect(markerSizeForZoom(ZOOMS.small)).toBe(MarkerSize.small);
    });

    it("is medium between the two thresholds, the upper one included", () => {
        expect(markerSizeForZoom(ZOOMS.small + 0.5)).toBe(MarkerSize.medium);
        expect(markerSizeForZoom((ZOOMS.small + ZOOMS.big) / 2)).toBe(MarkerSize.medium);
        expect(markerSizeForZoom(ZOOMS.big)).toBe(MarkerSize.medium);
    });

    it("is big past the upper threshold, all the way to the map's maximum", () => {
        expect(markerSizeForZoom(ZOOMS.big + 0.1)).toBe(MarkerSize.big);
        expect(markerSizeForZoom(ZOOM_RANGE.max)).toBe(MarkerSize.big);
    });
});
