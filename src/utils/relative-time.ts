import { spanLabel, type SpanUnit } from "./history-column";

/**
 * How old a timestamp may be before an absolute date reads better than a span.
 * "3 дн" is easier to place than a date; "37 дн" is not, and by then the exact
 * day is what a reader actually wants.
 */
export const RELATIVE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

/** Anything younger than this reads as "just now" rather than "0 мин". */
export const JUST_NOW_MS = 60_000;

export type Relative =
    | { kind: "now" }
    | { kind: "span"; value: number; unit: SpanUnit }
    | { kind: "absolute" };

/**
 * How to show `iso` given the current time. Returns the shape to render rather
 * than a string, so the wording stays in the dictionaries.
 */
export function relativeTime(iso: string, now: number): Relative {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) {
        return { kind: "absolute" };
    }
    const age = now - at;
    // A clock skewed into the future would otherwise produce a negative span.
    if (age < JUST_NOW_MS) {
        return { kind: "now" };
    }
    if (age >= RELATIVE_LIMIT_MS) {
        return { kind: "absolute" };
    }
    return { kind: "span", ...spanLabel(age) };
}
