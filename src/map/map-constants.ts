import type { LngLat, LngLatBounds, YMapCenterLocation, YMapLocationRequest, ZoomRange } from "@yandex/ymaps3-types";

// Lengths of the filter panel's morph, kept in step with `filters.scss`. The
// panel is clipped back to the round button's own circle, so for the morph to
// read as one object the button has to stay on screen for part of it.
export const FILTERS_OPEN_MS = 220;
export const FILTERS_CLOSE_MS = 180;
/** Diameter of the round button, and so of the circle the panel grows out of. */
export const FILTERS_BUTTON_SIZE = 56;

/** Debounce for heatmap reloads while the map is being moved. */
export const HEATMAP_DEBOUNCE_MS = 400;

export const YMAPS_API_KEY = import.meta.env.VITE_YMAPS_API_KEY ?? "";

export const LOCATION: YMapLocationRequest = {
    center: [41.452746, 52.722408],
    zoom: 11
};

/** The centre `LOCATION` starts at, already narrowed for the callers that need the tuple. */
export const INITIAL_CENTER = (LOCATION as YMapCenterLocation).center;
export const INITIAL_ZOOM = (LOCATION as { zoom: number }).zoom;

export const RESTRICT_AREA: LngLatBounds = [[40.96110892973163, 52.54600597551669], [41.91211295805194, 52.90452560092497]];

export const ZOOM_RANGE: ZoomRange = { min: 11, max: 22 };
export const ZOOMS = {
    small: 12,
    big: 16
};

/**
 * Map centres arrive with full float precision and jitter in the last bits while the
 * map settles. Five decimals is ~1 m — finer than the point can be placed by hand —
 * and it lets `setCoords` recognise an unchanged position instead of invalidating the
 * zone polygon on every frame. Cheaper than a throttle, and with no lag.
 */
const COORD_PRECISION = 1e5;
export const roundCoords = (coords: LngLat): LngLat =>
    [Math.round(coords[0] * COORD_PRECISION) / COORD_PRECISION, Math.round(coords[1] * COORD_PRECISION) / COORD_PRECISION];
