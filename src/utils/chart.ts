import { t } from "../i18n";
/** Helpers for the dependency-free SVG line chart on the analytics dashboard. */

export interface ChartSeries {
    key: string;
    label: string;
    color: string;
    values: number[];
}

export interface ChartLayout {
    width: number;
    height: number;
    padding: { top: number; right: number; bottom: number; left: number };
}

export const DEFAULT_CHART_LAYOUT: ChartLayout = {
    width: 360,
    height: 180,
    padding: { top: 8, right: 8, bottom: 20, left: 28 },
};

/** "Nice" upper bound for the Y axis (1, 2, 5 × 10^n), never below 1. */
export function niceMax(max: number): number {
    if (!Number.isFinite(max) || max <= 0) {
        return 1;
    }
    const exp = Math.floor(Math.log10(max));
    const base = Math.pow(10, exp);
    const m = max / base;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return nice * base;
}

/** SVG polyline points (`x,y x,y …`) of a series scaled into the layout; empty for < 1 value. */
export function linePoints(values: number[], yMax: number, layout: ChartLayout): string {
    const n = values.length;
    if (n === 0) {
        return "";
    }
    return values
        .map((v, i) => `${pointX(i, n, layout).toFixed(1)},${pointY(v, yMax, layout).toFixed(1)}`)
        .join(" ");
}

/**
 * Y tick values (0 .. yMax) for a given number of steps. For small integer maxima the number
 * of steps is reduced so that the rounded tick labels stay unique (`0, 1, 2` instead of `0, 0, 1, 1, 2`).
 */
export function yTicks(yMax: number, steps: number = 4): number[] {
    const safeMax = Number.isFinite(yMax) && yMax > 0 ? yMax : 1;
    const n = Math.max(1, Math.min(steps, Math.floor(safeMax)));
    const ticks: number[] = [];
    for (let i = 0; i <= n; i++) {
        ticks.push((safeMax * i) / n);
    }
    return ticks;
}

/** X coordinate of the i-th of `n` points; a single point is centered. */
export function pointX(i: number, n: number, layout: ChartLayout): number {
    const { width, padding } = layout;
    const innerW = width - padding.left - padding.right;
    return padding.left + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
}

/** Y coordinate of a value scaled into the layout (negative values are clamped to 0). */
export function pointY(value: number, yMax: number, layout: ChartLayout): number {
    const { height, padding } = layout;
    const innerH = height - padding.top - padding.bottom;
    return padding.top + innerH - (innerH * Math.max(0, value)) / (yMax || 1);
}

/** Short period label: `2026-08-17` -> `17.08`, `2026-08` -> `08.26`; other strings are returned as is. */
export function periodLabel(period: string): string {
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(period);
    if (day) {
        return `${day[3]}.${day[2]}`;
    }
    const month = /^(\d{4})-(\d{2})$/.exec(period);
    if (month) {
        return `${month[2]}.${month[1].slice(2)}`;
    }
    return period;
}

/** Formats hours as `—`, `5 ч` or `2.3 дн`. */
export function formatHours(hours: number | null | undefined): string {
    if (hours === null || hours === undefined || !Number.isFinite(hours)) {
        return "—";
    }
    if (hours < 48) {
        return `${Math.round(hours)} ${t("common.hours")}`;
    }
    return `${(hours / 24).toFixed(1)} ${t("common.days")}`;
}

/**
 * A figure and its unit, kept apart.
 *
 * `formatHours` and `formatShare` glue the two into one string, which reads as a
 * single word -- "7,4 ч" at one size and weight -- and stops the numbers lining
 * up in a column. Tiles that show a figure want them separate.
 */
export type Figure = { value: string; unit: string };

export function hoursFigure(hours: number | null | undefined): Figure {
    if (hours === null || hours === undefined || !Number.isFinite(hours)) {
        return { value: "—", unit: "" };
    }
    if (hours < 48) {
        return { value: String(Math.round(hours)), unit: t("common.hours") };
    }
    return { value: (hours / 24).toFixed(1), unit: t("common.days") };
}

export function shareFigure(share: number | null | undefined): Figure {
    if (share === null || share === undefined || !Number.isFinite(share)) {
        return { value: "—", unit: "" };
    }
    return { value: String(Math.round(share * 100)), unit: "%" };
}

/** Formats a 0..1 share as a percentage; `—` when unknown. */
export function formatShare(share: number | null | undefined): string {
    if (share === null || share === undefined || !Number.isFinite(share)) {
        return "—";
    }
    return `${Math.round(share * 100)} %`;
}

/** ISO date (YYYY-MM-DD) in local time. */
export function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
