import { describe, expect, it } from "vitest";
import { layerDepth, layerDepths, layerSpans, MAX_DEPTH, MIN_DEPTH, spanLabel } from "./history-column";

const H = 3_600_000;

describe("layerSpans", () => {
    it("measures each layer up to the start of the next", () => {
        const now = Date.parse("2026-05-01T10:00:00Z");
        expect(layerSpans(["2026-05-01T06:00:00Z", "2026-05-01T08:00:00Z"], now)).toEqual([2 * H, 2 * H]);
    });

    it("runs the last layer up to now, because it has not ended", () => {
        const now = Date.parse("2026-05-01T09:30:00Z");
        expect(layerSpans(["2026-05-01T08:00:00Z"], now)).toEqual([1.5 * H]);
    });

    it("never returns a negative span for out-of-order timestamps", () => {
        const now = Date.parse("2026-05-01T10:00:00Z");
        expect(layerSpans(["2026-05-01T08:00:00Z", "2026-05-01T06:00:00Z"], now)).toEqual([0, 4 * H]);
    });

    it("survives an unparseable timestamp", () => {
        const now = Date.parse("2026-05-01T10:00:00Z");
        expect(layerSpans(["nonsense", "2026-05-01T08:00:00Z"], now)).toEqual([0, 2 * H]);
    });

    it("returns nothing for no history", () => {
        expect(layerSpans([], Date.now())).toEqual([]);
    });
});

describe("layerDepth", () => {
    it("gives the longest layer the full depth", () => {
        expect(layerDepth(10 * H, 10 * H)).toBe(MAX_DEPTH);
    });

    it("floors a zero-length or unknown layer at the minimum", () => {
        expect(layerDepth(0, 10 * H)).toBe(MIN_DEPTH);
        expect(layerDepth(5 * H, 0)).toBe(MIN_DEPTH);
    });

    it("keeps a very short layer legible instead of a hairline", () => {
        // two minutes against a month: linear scaling would render ~0px
        const depth = layerDepth(2 * 60_000, 30 * 24 * H);
        expect(depth).toBeGreaterThan(MIN_DEPTH);
        expect(depth).toBeLessThan(MIN_DEPTH + 10);
    });

    it("preserves ordering: a longer layer is never drawn shorter", () => {
        const max = 100 * H;
        for (let i = 1; i < 50; i++) {
            expect(layerDepth((i + 1) * H, max)).toBeGreaterThanOrEqual(layerDepth(i * H, max));
        }
    });
});

describe("layerDepths", () => {
    it("scales a column against its own longest layer", () => {
        const depths = layerDepths([1 * H, 4 * H]);
        expect(depths[1]).toBe(MAX_DEPTH);
        expect(depths[0]).toBeLessThan(depths[1]);
    });

    it("draws a single layer at full depth", () => {
        expect(layerDepths([5 * H])).toEqual([MAX_DEPTH]);
    });
});

describe("spanLabel", () => {
    it("reports minutes below an hour", () => {
        expect(spanLabel(45 * 60_000)).toEqual({ value: 45, unit: "minutes" });
    });

    it("reports hours up to two days", () => {
        expect(spanLabel(30 * H)).toEqual({ value: 30, unit: "hours" });
    });

    it("reports days beyond that", () => {
        expect(spanLabel(10 * 24 * H)).toEqual({ value: 10, unit: "days" });
    });

    it("reports 0 minutes rather than an empty label for a sub-minute span", () => {
        expect(spanLabel(500)).toEqual({ value: 0, unit: "minutes" });
    });
});
