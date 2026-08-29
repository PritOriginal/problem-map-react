import { describe, expect, it } from "vitest";
import { formatDistance, parseSimilarMarks, similarMarksFromError } from "./similar";
import { ApiError } from "../services/http";

const mark = (id: number, distance?: number) => ({
    mark_id: id,
    name: "",
    geom: { type: "Point", coordinates: [41.4, 52.7] },
    mark_type_id: 1,
    description: "",
    user_id: 1,
    mark_status_id: 2,
    created_at: "",
    updated_at: "",
    ...(distance === undefined ? {} : { distance_m: distance }),
});

describe("parseSimilarMarks", () => {
    it("accepts an array (GET /marks/similar) sorted by distance", () => {
        const result = parseSimilarMarks([mark(2, 120.5), mark(1, 30)]);
        expect(result.map((m) => m.mark_id)).toEqual([1, 2]);
        expect(result[0].distance_m).toBe(30);
    });

    it("accepts { similar_marks } (409 from POST /marks)", () => {
        const result = parseSimilarMarks({ similar_marks: [mark(7, 10)] });
        expect(result).toHaveLength(1);
        expect(result[0].mark_id).toBe(7);
    });

    it("drops malformed entries and marks unknown distances as NaN (sorted last)", () => {
        const result = parseSimilarMarks([mark(1), { foo: "bar" }, null, mark(2, 5)]);
        expect(result.map((m) => m.mark_id)).toEqual([2, 1]);
        expect(Number.isNaN(result[1].distance_m)).toBe(true);
    });

    it("returns an empty list for anything else", () => {
        expect(parseSimilarMarks(undefined)).toEqual([]);
        expect(parseSimilarMarks("x")).toEqual([]);
        expect(parseSimilarMarks({})).toEqual([]);
    });
});

describe("similarMarksFromError", () => {
    it("extracts marks only from a 409 ApiError", () => {
        expect(similarMarksFromError(new ApiError("conflict", 409, { similar_marks: [mark(3, 1)] }))).toHaveLength(1);
        expect(similarMarksFromError(new ApiError("bad", 400, { similar_marks: [mark(3, 1)] }))).toEqual([]);
        expect(similarMarksFromError(new Error("x"))).toEqual([]);
    });
});

describe("formatDistance", () => {
    it("formats meters and kilometers", () => {
        expect(formatDistance(85.4)).toBe("85 м");
        expect(formatDistance(1234)).toBe("1.2 км");
        expect(formatDistance(NaN)).toBe("");
    });
});
