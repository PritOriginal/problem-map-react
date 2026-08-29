import convert from "color-convert";
import type { Feature } from "@yandex/ymaps3-clusterer";

import type { AdminBoundaryMarksCount } from "../services/MapService";
import { MarkStatusType } from "../services/MarksService";
import { markOf } from "./mark-feature";

/**
 * The colour of a cluster bubble, and of an administrative boundary, is the same
 * reading of the same three counts: a hue swept from red (nothing dealt with) to
 * green (everything closed), with a mark under review counting as half-closed.
 *
 * Both return a hex string WITHOUT the leading "#" — that is what `color-convert`
 * gives back, and the callers prepend it.
 */

/** Hue in the red -> green sweep for a set of counts. */
function hueFor(closed: number, underReview: number, all: number): number {
    return (closed + underReview / 2) / all * 120;
}

/** Cluster bubble: grey when the cluster holds nothing with a status we colour. */
export const getColorByFeatures = (features: readonly Feature[]) => {
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

    const h = hueFor(numsClosed, numsUnderReview, allNums);
    if (allNums > 0) {
        return convert.hsv.hex(h, 100, 80);
    } else {
        return "d3d3d3";
    }
};

/** Administrative boundary: green both when nothing is known and when nothing is open. */
export const getColorPolygon = (count: AdminBoundaryMarksCount | undefined) => {
    if (!count) {
        return "00cc00";
    }

    const allCount = count.confirmed_count + count.under_review_count + count.closed_count;
    if (allCount > 0) {
        const h = hueFor(count.closed_count, count.under_review_count, allCount);
        return convert.hsv.hex(h, 100, 80);
    } else {
        return "00cc00";
    }
};
