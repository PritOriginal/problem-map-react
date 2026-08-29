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
    const { width, height, padding } = layout;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    return values
        .map((v, i) => {
            const x = padding.left + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
            const y = padding.top + innerH - (innerH * Math.max(0, v)) / (yMax || 1);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}

/** Y tick values (0 .. yMax) for a given number of steps. */
export function yTicks(yMax: number, steps: number = 4): number[] {
    const ticks: number[] = [];
    for (let i = 0; i <= steps; i++) {
        ticks.push((yMax * i) / steps);
    }
    return ticks;
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
        return `${Math.round(hours)} ч`;
    }
    return `${(hours / 24).toFixed(1)} дн`;
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
