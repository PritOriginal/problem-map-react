/**
 * Marker sizes, keyed off the map zoom (see `useMapZoomSize`).
 *
 * In its own module rather than next to the marker component: as an export of
 * `mark.tsx` it broke fast refresh for every component in that file.
 */
export enum MarkerSize {
    small = "small",
    big = "big",
    medium = "medium",
}
