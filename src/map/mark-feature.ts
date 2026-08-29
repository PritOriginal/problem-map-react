import type { Feature } from "@yandex/ymaps3-clusterer";

import type { Mark } from "../services/MarksService";

/**
 * A clusterer feature carrying the mark it was built from.
 *
 * The clusterer's own `Feature` types `properties` as an optional untyped record, so
 * every read of the mark used to be its own `f.properties!.mark as Mark`. Every feature
 * on this map is built by `toMarkFeature`, so the invariant holds; it is stated once in
 * this type and asserted once, in `markOf`, instead of at each of the readers.
 */
export type MarkFeature = Feature & { properties: { mark: Mark } };

/**
 * The mark a clusterer feature was built from.
 *
 * The clusterer hands its `marker` and `cluster` callbacks a bare `Feature` — it cannot
 * be told about `MarkFeature`, since a narrower parameter is not a valid callback for a
 * wider one — so the narrowing happens here, at that one boundary.
 */
export function markOf(feature: Feature): Mark {
    return (feature as MarkFeature).properties.mark;
}

export function toMarkFeature(mark: Mark): MarkFeature {
    return {
        geometry: mark.geom,
        type: "Feature",
        id: String(mark.mark_id),
        properties: {
            mark: mark
        }
    };
}
