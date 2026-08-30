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
    "--ink": "#e4e7e9",
    "--ink-muted": "#9aa0a4",
    "--paper": "#1e2225",
    "--placeholder": "#2a2e31",
    "--rule": "#31373b",
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
    1: "#a5a29a", // unconfirmed -- neutral, recedes into the basemap
    2: "#d32020", // confirmed
    3: "#d09400", // under review -- was #f4b71a, which measured 1.65:1 on the light ground
    4: "#d32020", // rediscovered -- deliberately the same red as confirmed
    5: "#2aa85c", // closed -- kept clear of confirmed in LIGHTNESS, not only in hue
    6: "#5b6266", // refuted -- was #43474a, the darkest thing on the map for the least important state
    7: "#e0630c", // in progress
    8: "#8b9095", // duplicate
};

/**
 * The same scale for a dark basemap. Every value is lifted: on the dark ground
 * the light-theme greys disappear and the deep red reads as brown.
 *
 * The three that matter most are 2, 7 and 3 -- confirmed, in progress, under
 * review. Red, orange and amber collapse onto a single axis under deuteranopia,
 * so what has to hold them apart is LIGHTNESS, and here it does: 29, 45 and 74
 * out of 100. The scale this replaced managed 29, 44 and 62, and squeezed the
 * first pair into a fifth of the room. `src/map/basemap/basemap.test.ts` holds it.
 */
export const STATUS_COLORS_DARK: Readonly<Record<number, string>> = {
    1: "#8d8a85", // unconfirmed
    2: "#ff5a5f", // confirmed
    3: "#f0e442", // under review
    4: "#ff5a5f", // rediscovered
    5: "#00c39a", // closed
    6: "#9aa4a9", // refuted -- mid grey: visible on a night ground without shouting
    7: "#ff9d1e", // in progress
    8: "#7f8d98", // duplicate
};

/** The status scale for a theme. Takes a plain string so this module stays pure. */
export function statusColors(theme: "light" | "dark"): Readonly<Record<number, string>> {
    return theme === "dark" ? STATUS_COLORS_DARK : STATUS_COLORS;
}

/** Fallback when a status has no colour of its own. */
export const STATUS_FALLBACK = STATUS_COLORS[1];

// The analytics chart's series colours are NOT here: that chart is inline SVG in
// the document, so it resolves `var()` like anything else and reads them from
// `--series-*` in `src/tokens.scss` directly. Only renderers that cannot see the
// cascade -- the WebGL map -- need a mirror.
