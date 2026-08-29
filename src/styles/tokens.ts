/**
 * Colour values for renderers that cannot resolve CSS custom properties.
 *
 * Yandex Maps draws markers, clusters and polygons in WebGL, and the analytics
 * chart is hand-built SVG whose presentation attributes take no `var()`. Both
 * need literal strings, so those values live here rather than in `src/tokens.scss`.
 *
 * Two kinds of value live in this file, and the distinction matters:
 *
 *  - `CSS_MIRROR` duplicates tokens that BOTH stylesheets and renderers need.
 *    Duplication is a liability, so `tokens.parity.test.ts` reads `src/tokens.scss`
 *    and fails the build if the two ever drift, exactly as `src/i18n/parity.test.ts`
 *    does for the two dictionaries.
 *
 *  - The mark-status and heat scales are DATA, not chrome. They are the one place
 *    saturated colour is allowed, they are what the map legend explains, and the
 *    backend can override a type's colour per mark type. They have no CSS twin.
 */

/** Tokens duplicated from `src/tokens.scss`. Kept honest by `tokens.parity.test.ts`. */
export const CSS_MIRROR = {
    "--ink": "#000000",
    "--ink-muted": "#555555",
    "--paper": "#ffffff",
    "--placeholder": "#e5e5e5",
    "--rule": "#c9c9c9",
    "--rule-faint": "#8a8a8a",
    "--alert": "#e50000",
    "--success-ink": "#00a000",
    "--assigned": "#1e6fff",
    "--highlight-rule": "#e5d600",
} as const;

export const INK = CSS_MIRROR["--ink"];
export const INK_MUTED = CSS_MIRROR["--ink-muted"];
export const PAPER = CSS_MIRROR["--paper"];
export const PLACEHOLDER = CSS_MIRROR["--placeholder"];
export const RULE = CSS_MIRROR["--rule"];
export const ASSIGNED = CSS_MIRROR["--assigned"];

/**
 * Mark status colours, keyed by `mark_status_id`. Data, not chrome: these are what
 * the map legend names, and `src/utils/mark-types.ts` lets the backend override the
 * colour per mark type. Status 6 (refuted) is pure black and will need a lighter
 * value once the dark map style lands.
 */
export const STATUS_COLORS: Readonly<Record<number, string>> = {
    1: "#d3d3d3", // unconfirmed
    2: "#e50000", // confirmed
    3: "#e5d600", // under review
    4: "#e50000", // rediscovered
    5: "#00e500", // closed
    6: "#000000", // refuted
    7: "#ff8c00", // in progress
    8: "#8a8a8a", // duplicate
};

/** Fallback when a status has no colour of its own. */
export const STATUS_FALLBACK = STATUS_COLORS[1];

/** Analytics chart series, in the order they are drawn. */
export const SERIES_COLORS = {
    created: "#1f77b4",
    confirmed: CSS_MIRROR["--alert"],
    closed: CSS_MIRROR["--success-ink"],
    refuted: CSS_MIRROR["--ink"],
} as const;

/**
 * Ink on top of an arbitrary fill colour, chosen for contrast.
 *
 * Mark type colours come from the backend, so neither white nor black can be
 * hardcoded on top of them. Uses the WCAG relative-luminance threshold rather than
 * a naive channel average, which misjudges saturated blues and yellows.
 */
export function contrastOn(background: string): string {
    const hex = background.replace("#", "");
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    // Anything that is not a real hex colour (a CSS keyword, an empty string, junk
    // from the backend) gets the safe default rather than a NaN luminance.
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) {
        return INK;
    }
    const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(parseInt(full.slice(0, 2), 16));
    const g = channel(parseInt(full.slice(2, 4), 16));
    const b = channel(parseInt(full.slice(4, 6), 16));
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // contrast against white is 1.05 / (L + 0.05); against black it is (L + 0.05) / 0.05.
    // They cross at L = 0.1791, so pick whichever side of that the fill falls on.
    return luminance > 0.1791 ? INK : PAPER;
}
