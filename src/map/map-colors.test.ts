import { describe, expect, it } from "vitest";
import convert from "color-convert";

import { getColorByFeatures, getColorPolygon } from "./map-colors";
import { toMarkFeature } from "./mark-feature";
import type { AdminBoundaryMarksCount } from "../services/MapService";
import { type Mark, MarkStatusType } from "../services/MarksService";

function mark(statusId: number, id: number = statusId): Mark {
    return {
        mark_id: id,
        name: `mark ${id}`,
        geom: { type: "Point", coordinates: [41, 52] },
        mark_type_id: 1,
        description: "",
        user_id: 1,
        mark_status_id: statusId,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
}

const features = (...statusIds: number[]) => statusIds.map((s, i) => toMarkFeature(mark(s, i + 1)));

/** The hue the calculators sweep: 0 (red, nothing dealt with) to 120 (green, all closed). */
const hex = (hue: number) => convert.hsv.hex(hue, 100, 80);

function counts(over: Partial<AdminBoundaryMarksCount> = {}): AdminBoundaryMarksCount {
    return {
        id: 1,
        name: "district",
        total_count: 0,
        unconfirmed_count: 0,
        confirmed_count: 0,
        under_review_count: 0,
        closed_count: 0,
        ...over,
    };
}

describe("getColorByFeatures", () => {
    it("is the neutral grey for an empty cluster", () => {
        expect(getColorByFeatures([])).toBe("d3d3d3");
    });

    it("is the neutral grey when no mark carries a status that is counted", () => {
        // unconfirmed, refuted, in work and duplicate are all outside the three counters,
        // so a cluster made only of them weighs nothing and stays grey rather than red.
        expect(getColorByFeatures(features(
            MarkStatusType.UnconfirmedStatus,
            MarkStatusType.RefutedStatus,
            MarkStatusType.InWorkStatus,
            MarkStatusType.DuplicateStatus,
        ))).toBe("d3d3d3");
    });

    it("is red when everything is confirmed and nothing has moved", () => {
        expect(getColorByFeatures(features(MarkStatusType.ConfirmedStatus))).toBe(hex(0));
    });

    it("counts a rediscovered mark as confirmed", () => {
        expect(getColorByFeatures(features(
            MarkStatusType.RediscoveredStatus,
            MarkStatusType.RediscoveredStatus,
        ))).toBe(hex(0));
    });

    it("is green when everything is closed", () => {
        expect(getColorByFeatures(features(
            MarkStatusType.ClosedStatus,
            MarkStatusType.ClosedStatus,
        ))).toBe(hex(120));
    });

    it("counts a mark under review as half closed", () => {
        expect(getColorByFeatures(features(MarkStatusType.UnderReviewStatus))).toBe(hex(60));
        expect(getColorByFeatures(features(
            MarkStatusType.ConfirmedStatus,
            MarkStatusType.UnderReviewStatus,
        ))).toBe(hex(30));
    });

    it("mixes the three counters", () => {
        // 1 closed + 1 under review out of 4 -> (1 + 0.5) / 4 * 120
        expect(getColorByFeatures(features(
            MarkStatusType.ConfirmedStatus,
            MarkStatusType.ConfirmedStatus,
            MarkStatusType.UnderReviewStatus,
            MarkStatusType.ClosedStatus,
        ))).toBe(hex(45));
    });

    it("ignores marks with an uncounted status when weighing the rest", () => {
        expect(getColorByFeatures(features(
            MarkStatusType.ClosedStatus,
            MarkStatusType.UnconfirmedStatus,
            MarkStatusType.RefutedStatus,
        ))).toBe(hex(120));
    });
});

describe("getColorPolygon", () => {
    it("is green when there are no counts for the boundary at all", () => {
        expect(getColorPolygon(undefined)).toBe("00cc00");
    });

    it("is the same green when every counter is zero", () => {
        // Deliberately NOT the cluster's grey: a district with nothing reported in it
        // is a district with nothing wrong, which is the good end of the scale.
        expect(getColorPolygon(counts())).toBe("00cc00");
    });

    it("is red when everything is still confirmed", () => {
        expect(getColorPolygon(counts({ confirmed_count: 3, total_count: 3 }))).toBe(hex(0));
    });

    it("is green when everything is closed", () => {
        expect(getColorPolygon(counts({ closed_count: 3, total_count: 3 }))).toBe(hex(120));
    });

    it("counts marks under review as half closed", () => {
        expect(getColorPolygon(counts({ confirmed_count: 1, under_review_count: 1 }))).toBe(hex(30));
        expect(getColorPolygon(counts({ confirmed_count: 2, under_review_count: 1, closed_count: 1 }))).toBe(hex(45));
    });

    it("ignores unconfirmed marks, which are not part of the weighed total", () => {
        expect(getColorPolygon(counts({ unconfirmed_count: 9, closed_count: 1 }))).toBe(hex(120));
    });
});
