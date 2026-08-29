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
    "--ink": "#1b1d1c",
    "--ink-muted": "#6b6f72",
    "--paper": "#ffffff",
    "--placeholder": "#e4e2dc",
    "--rule": "#d6d4ce",
    "--rule-faint": "#a8a59e",
    "--alert": "#d92b2b",
    "--success-ink": "#1e7a3c",
    "--assigned": "#ff2e88",
    "--highlight-rule": "#f4b71a",
} as const;

/**
 * The same tokens under the dark theme, mirrored from the `dark-theme` mixin in
 * src/tokens.scss. The map draws boundary strokes and heat-cell outlines with
 * these, and a black stroke is invisible on a dark basemap.
 */
export const CSS_MIRROR_DARK = {
    "--ink": "#e6e8e9",
    "--ink-muted": "#9aa0a4",
    "--paper": "#1f2225",
    "--placeholder": "#2a2e31",
    "--rule": "#31363a",
    "--rule-faint": "#5c6266",
    "--alert": "#ff5c5c",
    "--success-ink": "#55cc83",
    "--assigned": "#ff2e88",
    "--highlight-rule": "#ffc93d",
} as const;

/** The mirrored tokens for a theme. Takes a plain string so this module stays pure. */
export function themeColors(theme: "light" | "dark"): typeof CSS_MIRROR | typeof CSS_MIRROR_DARK {
    return theme === "dark" ? CSS_MIRROR_DARK : CSS_MIRROR;
}

export const INK = CSS_MIRROR["--ink"];
export const INK_MUTED = CSS_MIRROR["--ink-muted"];
export const PAPER = CSS_MIRROR["--paper"];
export const PLACEHOLDER = CSS_MIRROR["--placeholder"];
export const RULE = CSS_MIRROR["--rule"];
export const ASSIGNED = CSS_MIRROR["--assigned"];
/** Category glyphs on a marker disc: always white, in both themes. */
export const MARKER_ICON = "#ffffff";

/**
 * Mark status colours, keyed by `mark_status_id`. Data, not chrome: these are what
 * the map legend names, and `src/utils/mark-types.ts` lets the backend override the
 * colour per mark type. Tuned to one coherent scale that stays legible on the
 * desaturated basemap -- and none of them is the accent pink, so a status can never
 * be confused with the interface's own marks.
 */
export const STATUS_COLORS: Readonly<Record<number, string>> = {
    1: "#b9b6ae", // unconfirmed -- neutral, recedes into the basemap
    2: "#d92b2b", // confirmed
    3: "#f4b71a", // under review
    4: "#d92b2b", // rediscovered -- deliberately the same red as confirmed
    5: "#2fa55a", // closed
    6: "#43474a", // refuted -- a dark slate, not pure black, so it survives a dark basemap
    7: "#f07316", // in progress
    8: "#8b8f91", // duplicate
};

/**
 * The same scale for a dark basemap. Every value is lifted: on the dark ground
 * the light-theme greys disappear and the deep red reads as brown. Refuted (6)
 * moves furthest -- a dark slate is invisible against a dark map.
 */
export const STATUS_COLORS_DARK: Readonly<Record<number, string>> = {
    1: "#8a8782", // unconfirmed
    2: "#ff5c5c", // confirmed
    3: "#ffc93d", // under review
    4: "#ff5c5c", // rediscovered
    5: "#55cc83", // closed
    6: "#aab0b4", // refuted
    7: "#ff9440", // in progress
    8: "#6f7477", // duplicate
};

/** The status scale for a theme. Takes a plain string so this module stays pure. */
export function statusColors(theme: "light" | "dark"): Readonly<Record<number, string>> {
    return theme === "dark" ? STATUS_COLORS_DARK : STATUS_COLORS;
}

/** Fallback when a status has no colour of its own. */
export const STATUS_FALLBACK = STATUS_COLORS[1];

/** Analytics chart series, in the order they are drawn. */
export const SERIES_COLORS = {
    created: "#1f77b4",
    confirmed: CSS_MIRROR["--alert"],
    closed: CSS_MIRROR["--success-ink"],
    refuted: CSS_MIRROR["--ink"],
} as const;
