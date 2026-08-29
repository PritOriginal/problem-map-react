import { describe, expect, it } from "vitest";
import { filtersEqual, parseFilters, serializeFilters } from "./filters";

const defaults = { mark_type_ids: [], mark_status_ids: [1, 2, 3, 4, 5] };

describe("serializeFilters", () => {
    it("writes both params as comma-separated ids", () => {
        const params = serializeFilters({ mark_type_ids: [1, 3], mark_status_ids: [2] }, defaults);
        expect(params.get("types")).toBe("1,3");
        expect(params.get("statuses")).toBe("2");
        expect(params.toString()).toBe("types=1%2C3&statuses=2");
    });

    it("writes empty lists as empty params and keeps unrelated params", () => {
        const params = serializeFilters({ mark_type_ids: [], mark_status_ids: [] }, defaults, "foo=bar");
        expect(params.get("types")).toBeNull();
        expect(params.get("statuses")).toBe("");
        expect(params.get("foo")).toBe("bar");
    });

    it("omits params equal to the defaults (order-insensitive) and drops stale ones from base", () => {
        const params = serializeFilters({ mark_type_ids: [], mark_status_ids: [5, 4, 3, 2, 1] }, defaults, "types=1&statuses=2&foo=bar");
        expect(params.toString()).toBe("foo=bar");
    });
});

describe("parseFilters", () => {
    it("parses ids from the query", () => {
        expect(parseFilters("?types=1,3&statuses=2,5", defaults)).toEqual({ mark_type_ids: [1, 3], mark_status_ids: [2, 5] });
        expect(parseFilters(new URLSearchParams("types=4"), defaults)).toEqual({ mark_type_ids: [4], mark_status_ids: [1, 2, 3, 4, 5] });
    });

    it("keeps defaults for absent params but honours empty ones", () => {
        expect(parseFilters("", defaults)).toEqual(defaults);
        expect(parseFilters("?statuses=", defaults)).toEqual({ mark_type_ids: [], mark_status_ids: [] });
    });

    it("drops garbage and duplicates", () => {
        expect(parseFilters("?types=1,x,,-2,1.5,3,3&statuses=abc", defaults)).toEqual({ mark_type_ids: [1, 3], mark_status_ids: [] });
        expect(parseFilters("?types=0x10,1e2,0,%202,Infinity,99999999999999999999", defaults)).toEqual({ mark_type_ids: [2], mark_status_ids: [1, 2, 3, 4, 5] });
    });

    it("does not alias the defaults arrays", () => {
        const parsed = parseFilters("", defaults);
        parsed.mark_status_ids.push(99);
        expect(defaults.mark_status_ids).toEqual([1, 2, 3, 4, 5]);
    });

    it("round-trips through serializeFilters", () => {
        const filters = { mark_type_ids: [2, 5], mark_status_ids: [1, 6] };
        expect(parseFilters(serializeFilters(filters, defaults), defaults)).toEqual(filters);
        expect(parseFilters(serializeFilters(defaults, defaults), defaults)).toEqual(defaults);
    });
});

describe("filtersEqual", () => {
    it("ignores order and detects differences", () => {
        expect(filtersEqual({ mark_type_ids: [1, 2], mark_status_ids: [3] }, { mark_type_ids: [2, 1], mark_status_ids: [3] })).toBe(true);
        expect(filtersEqual({ mark_type_ids: [1], mark_status_ids: [3] }, { mark_type_ids: [1, 2], mark_status_ids: [3] })).toBe(false);
    });
});
