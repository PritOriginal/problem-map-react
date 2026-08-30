import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_LAYOUT, formatHours, formatShare, hoursFigure, linePoints, niceMax, periodLabel, shareFigure, yTicks } from "./chart";
import { t } from "../i18n";

describe("niceMax", () => {
    it("rounds up to 1/2/5 × 10^n and never below 1", () => {
        expect(niceMax(0)).toBe(1);
        expect(niceMax(3)).toBe(5);
        expect(niceMax(7)).toBe(10);
        expect(niceMax(12)).toBe(20);
        expect(niceMax(50)).toBe(50);
        expect(niceMax(51)).toBe(100);
    });
});

describe("linePoints", () => {
    it("scales values into the layout: first at the left edge, max at the top", () => {
        const { padding, width, height } = DEFAULT_CHART_LAYOUT;
        const pts = linePoints([0, 10], 10, DEFAULT_CHART_LAYOUT).split(" ");
        expect(pts).toHaveLength(2);
        expect(pts[0]).toBe(`${padding.left.toFixed(1)},${(height - padding.bottom).toFixed(1)}`);
        expect(pts[1]).toBe(`${(width - padding.right).toFixed(1)},${padding.top.toFixed(1)}`);
        expect(linePoints([], 1, DEFAULT_CHART_LAYOUT)).toBe("");
        // a single value is centered horizontally
        const single = linePoints([5], 10, DEFAULT_CHART_LAYOUT);
        expect(single).toBe(`${(padding.left + (width - padding.left - padding.right) / 2).toFixed(1)},${(padding.top + (height - padding.top - padding.bottom) / 2).toFixed(1)}`);
    });
});

describe("labels", () => {
    it("produces y ticks and short period labels", () => {
        expect(yTicks(20, 4)).toEqual([0, 5, 10, 15, 20]);
        expect(yTicks(1)).toEqual([0, 1]);
        expect(yTicks(2)).toEqual([0, 1, 2]);
        expect(yTicks(0)).toEqual([0, 1]);
        expect(periodLabel("2026-08-17")).toBe("17.08");
        expect(periodLabel("2026-08-17T00:00:00Z")).toBe("17.08");
        expect(periodLabel("2026-08")).toBe("08.26");
        expect(periodLabel("W34")).toBe("W34");
    });

    it("formats hours and shares", () => {
        expect(formatHours(null)).toBe("—");
        expect(formatHours(5.4)).toBe("5 ч");
        expect(formatHours(60)).toBe("2.5 дн");
        expect(formatShare(0.256)).toBe("26 %");
        expect(formatShare(null)).toBe("—");
    });
});

describe("hoursFigure / shareFigure", () => {
    it("keeps the number and the unit apart", () => {
        expect(hoursFigure(7)).toEqual({ value: "7", unit: t("common.hours") });
        expect(hoursFigure(72)).toEqual({ value: "3.0", unit: t("common.days") });
        expect(shareFigure(0.083)).toEqual({ value: "8", unit: "%" });
    });

    it("returns an em dash and no unit when the value is unknown", () => {
        expect(hoursFigure(null)).toEqual({ value: "—", unit: "" });
        expect(hoursFigure(Number.NaN)).toEqual({ value: "—", unit: "" });
        expect(shareFigure(undefined)).toEqual({ value: "—", unit: "" });
    });
});
