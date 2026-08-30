import type { Feature } from "@yandex/ymaps3-clusterer";

import type { AdminBoundaryMarksCount } from "../services/MapService";
import { MarkStatusType } from "../services/MarksService";
import { markOf } from "./mark-feature";

/**
 * The colour of a cluster bubble, and of an administrative boundary, is the same
 * reading of the same three counts: a hue swept from red (nothing dealt with) to
 * green (everything closed), with a mark under review counting as half-closed.
 *
 * Both return a hex string WITHOUT the leading "#" — that is what the callers
 * prepend.
 */

/**
 * HSV (h in degrees, s and v in percent) to an uppercase six-digit hex string,
 * without a leading "#".
 *
 * This is the whole of what `color-convert` was imported for — two calls into a
 * ~25 KB package that shipped its entire conversion graph to every visitor of the
 * map. A line-for-line port of its `hsv -> rgb -> hex` route: the same sector split,
 * the same single rounding at the very end (the route does not round the
 * intermediate rgb), and the same uppercase output, so the colours on the map are
 * byte-identical to the ones the package produced.
 */
export function hsvToHex(h: number, s: number, v: number): string {
    const sector = h / 60;
    const saturation = s / 100;
    const value = v / 100;
    const hi = Math.floor(sector) % 6;
    const f = sector - Math.floor(sector);

    const p = 255 * value * (1 - saturation);
    const q = 255 * value * (1 - saturation * f);
    const t = 255 * value * (1 - saturation * (1 - f));
    const max = 255 * value;

    let rgb: [number, number, number];
    switch (hi) {
        case 0: rgb = [max, t, p]; break;
        case 1: rgb = [q, max, p]; break;
        case 2: rgb = [p, max, t]; break;
        case 3: rgb = [p, q, max]; break;
        case 4: rgb = [t, p, max]; break;
        default: rgb = [max, p, q]; break;
    }

    return rgb
        .map((channel) => (Math.round(channel) & 0xFF).toString(16).toUpperCase().padStart(2, "0"))
        .join("");
}

/**
 * Hue in the red -> green sweep for a set of counts.
 *
 * `all` is a sum of the very counts being weighed, so it is zero exactly when there is
 * nothing to weigh; the guard is here rather than at the call sites, which used to
 * divide first and lean on a later branch to throw the resulting NaN away.
 */
function hueFor(closed: number, underReview: number, all: number): number {
    if (all <= 0) {
        return 0;
    }
    return (closed + underReview / 2) / all * 120;
}

/**
 * How saturated and how light the red->green sweep is drawn, and what a cluster with
 * nothing to weigh looks like. It is a property of the basemap underneath: the same
 * 100/80 sweep that reads as data over the light map is a set of glowing lozenges
 * over Carbon, and the default grey `d3d3d3` is brighter there than any real status.
 * `src/map/basemap/basemap.ts` supplies one per theme.
 */
export interface ColorSweep {
    saturation: number;
    value: number;
}

export interface ClusterTone extends ColorSweep {
    /** Six hex digits, no leading "#", like everything else this module returns. */
    neutral: string;
}

export const DEFAULT_CLUSTER_TONE: ClusterTone = { saturation: 100, value: 80, neutral: "d3d3d3" };

/** Cluster bubble: neutral when the cluster holds nothing with a status we colour. */
export const getColorByFeatures = (features: readonly Feature[], tone: ClusterTone = DEFAULT_CLUSTER_TONE) => {
    let numsConfirmed = 0;
    let numsUnderReview = 0;
    let numsClosed = 0;
    features.forEach(f => {
        const mark = markOf(f);
        if (mark.mark_status_id == MarkStatusType.ConfirmedStatus ||
            mark.mark_status_id == MarkStatusType.RediscoveredStatus) {
            numsConfirmed++;
        } else if (mark.mark_status_id == MarkStatusType.UnderReviewStatus) {
            numsUnderReview++;
        } else if (mark.mark_status_id == MarkStatusType.ClosedStatus) {
            numsClosed++;
        }
    });

    const allNums = numsConfirmed + numsUnderReview + numsClosed;
    if (allNums === 0) {
        return tone.neutral;
    }
    return hsvToHex(hueFor(numsClosed, numsUnderReview, allNums), tone.saturation, tone.value);
};

/** Administrative boundary: green both when nothing is known and when nothing is open. */
export const getColorPolygon = (count: AdminBoundaryMarksCount | undefined, tone: ColorSweep = DEFAULT_CLUSTER_TONE) => {
    const allCount = count ? count.confirmed_count + count.under_review_count + count.closed_count : 0;
    if (allCount === 0) {
        // "Everything here is dealt with", drawn at the arm's own strength rather than
        // at a literal, so a district wash cannot be the brightest thing on a night map.
        return hsvToHex(120, tone.saturation, tone.value).toLowerCase();
    }
    return hsvToHex(hueFor(count!.closed_count, count!.under_review_count, allCount), tone.saturation, tone.value);
};
