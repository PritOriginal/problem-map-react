/**
 * Geometry for the mark history column -- the vertical "core sample" that replaces
 * the flat stack of history blocks.
 *
 * The point of drawing it as a column is that the DEPTH of each layer carries
 * information the old list threw away: how long the mark actually sat in that
 * status. An operator can see that a report waited three weeks for review instead
 * of only that it was reviewed.
 */

/** Shortest and tallest a layer may be drawn, in px. */
export const MIN_DEPTH = 44;
export const MAX_DEPTH = 180;

/**
 * Milliseconds spent in each status.
 *
 * `changedAt` is the moment each status began, oldest first. A layer lasts until
 * the next one begins; the last layer is still running, so it lasts until `now`.
 * Non-monotonic or unparseable timestamps yield 0 rather than a negative depth.
 */
export function layerSpans(changedAt: string[], now: number): number[] {
    const starts = changedAt.map((value) => {
        const t = Date.parse(value);
        return Number.isNaN(t) ? null : t;
    });
    return starts.map((start, i) => {
        if (start === null) {
            return 0;
        }
        const next = i + 1 < starts.length ? starts[i + 1] : now;
        if (next === null) {
            return 0;
        }
        return Math.max(0, next - start);
    });
}

/**
 * Depth in px for a span, against the longest span in the same column.
 *
 * Square-rooted rather than linear: a mark that sat a month in one status and two
 * minutes in another would, on a linear scale, render the short layer as a
 * hairline. The square root keeps every layer legible while preserving the
 * ordering, which is what the reader actually needs from the shape.
 */
export function layerDepth(spanMs: number, maxSpanMs: number): number {
    if (!(maxSpanMs > 0) || !(spanMs > 0)) {
        return MIN_DEPTH;
    }
    const ratio = Math.sqrt(Math.min(spanMs, maxSpanMs) / maxSpanMs);
    return Math.round(MIN_DEPTH + (MAX_DEPTH - MIN_DEPTH) * ratio);
}

/** Depths for a whole column, scaled against its own longest layer. */
export function layerDepths(spans: number[]): number[] {
    const max = spans.reduce((a, b) => Math.max(a, b), 0);
    return spans.map((span) => layerDepth(span, max));
}

export type SpanUnit = "minutes" | "hours" | "days";

/**
 * A span reduced to one round figure and its unit, for `t("common." + unit)`.
 * Anything under a minute reports as 0 minutes rather than an empty label.
 */
export function spanLabel(spanMs: number): { value: number; unit: SpanUnit } {
    const minutes = Math.floor(spanMs / 60_000);
    if (minutes < 60) {
        return { value: Math.max(0, minutes), unit: "minutes" };
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 48) {
        return { value: hours, unit: "hours" };
    }
    return { value: Math.floor(hours / 24), unit: "days" };
}
