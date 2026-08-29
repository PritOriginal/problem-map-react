import type { Mark, SimilarMark } from "../services/MarksService";
import { ApiError } from "../services/http";
import { t } from "../i18n";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isMarkLike(value: unknown): value is Mark {
    return isRecord(value) && typeof value.mark_id === "number" && isRecord(value.geom);
}

/**
 * Normalizes a list of similar marks from an API payload: accepts either an array
 * (`GET /marks/similar`) or an object with `similar_marks` (409 from `POST /marks`).
 * Entries without a numeric `distance_m` get `NaN`; malformed entries are dropped.
 */
export function parseSimilarMarks(payload: unknown): SimilarMark[] {
    let list: unknown = payload;
    if (isRecord(payload) && !Array.isArray(payload)) {
        list = payload.similar_marks ?? payload.marks ?? [];
    }
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .filter(isMarkLike)
        .map((mark) => {
            const distance = (mark as unknown as Record<string, unknown>).distance_m;
            return { ...mark, distance_m: typeof distance === "number" ? distance : NaN };
        })
        .sort((a, b) => (Number.isNaN(a.distance_m) ? 1 : 0) - (Number.isNaN(b.distance_m) ? 1 : 0) || a.distance_m - b.distance_m);
}

/** Similar marks carried by a 409 Conflict from `POST /marks`, or an empty list for any other error. */
export function similarMarksFromError(error: unknown): SimilarMark[] {
    if (error instanceof ApiError && error.status === 409) {
        return parseSimilarMarks(error.payload);
    }
    return [];
}

/** Formats a distance in meters: `85 м`, `1.2 км`; unknown distances yield an empty string. */
export function formatDistance(meters: number): string {
    if (!Number.isFinite(meters)) {
        return "";
    }
    if (meters < 1000) {
        return `${Math.round(meters)} ${t("common.meters")}`;
    }
    return `${(meters / 1000).toFixed(1)} ${t("common.kilometers")}`;
}
