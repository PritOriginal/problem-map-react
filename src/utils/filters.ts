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

function sameIds(x: number[], y: number[]): boolean {
    if (x.length !== y.length) {
        return false;
    }
    const sortedY = [...y].sort((a, b) => a - b);
    return [...x].sort((a, b) => a - b).every((v, i) => v === sortedY[i]);
}

function setIdsParam(params: URLSearchParams, name: string, ids: number[], defaults: number[]) {
    if (sameIds(ids, defaults)) {
        params.delete(name);
    } else {
        params.set(name, ids.join(","));
    }
}

/**
 * Writes mark filters into query params (`?types=1,2&statuses=3`) on top of `base`.
 * A list equal to its default is omitted, so the default view keeps a clean URL;
 * an empty non-default list is written as an empty param so it still overrides the default.
 */
export function serializeFilters(filters: GetMarksRequest, defaults: GetMarksRequest, base?: URLSearchParams | string): URLSearchParams {
    const params = new URLSearchParams(base);
    setIdsParam(params, TYPES_PARAM, filters.mark_type_ids, defaults.mark_type_ids);
    setIdsParam(params, STATUSES_PARAM, filters.mark_status_ids, defaults.mark_status_ids);
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
    return sameIds(a.mark_type_ids, b.mark_type_ids) && sameIds(a.mark_status_ids, b.mark_status_ids);
}
