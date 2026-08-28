import { GetMarksRequest } from "../services/MarksService";

export const TYPES_PARAM = "types";
export const STATUSES_PARAM = "statuses";

function parseIds(raw: string | null): number[] | null {
    if (raw === null) {
        return null;
    }
    const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s))
        .map(Number)
        .filter((n) => Number.isSafeInteger(n) && n > 0);
    return Array.from(new Set(ids));
}

/**
 * Writes mark filters into query params (`?types=1,2&statuses=3`).
 * Empty lists are written as an empty param so the URL still overrides the defaults.
 */
export function serializeFilters(filters: GetMarksRequest, base?: URLSearchParams | string): URLSearchParams {
    const params = new URLSearchParams(base);
    params.set(TYPES_PARAM, filters.mark_type_ids.join(","));
    params.set(STATUSES_PARAM, filters.mark_status_ids.join(","));
    return params;
}

/**
 * Reads mark filters from query params. A param that is absent keeps the default;
 * a present param (even empty) replaces it. Non-numeric entries are dropped.
 */
export function parseFilters(search: URLSearchParams | string, defaults: GetMarksRequest): GetMarksRequest {
    const params = new URLSearchParams(search);
    return {
        mark_type_ids: parseIds(params.get(TYPES_PARAM)) ?? [...defaults.mark_type_ids],
        mark_status_ids: parseIds(params.get(STATUSES_PARAM)) ?? [...defaults.mark_status_ids],
    };
}

/** Returns true when both filter sets contain the same ids (order-insensitive). */
export function filtersEqual(a: GetMarksRequest, b: GetMarksRequest): boolean {
    const same = (x: number[], y: number[]) => x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
    return same(a.mark_type_ids, b.mark_type_ids) && same(a.mark_status_ids, b.mark_status_ids);
}
