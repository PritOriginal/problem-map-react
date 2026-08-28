import { describe, expect, it } from "vitest";
import { nullableInt } from "./nullable";

describe("nullableInt", () => {
    it("returns plain numbers as-is", () => {
        expect(nullableInt(5)).toBe(5);
        expect(nullableInt(0)).toBe(0);
    });

    it("returns null for null/undefined", () => {
        expect(nullableInt(null)).toBeNull();
        expect(nullableInt(undefined)).toBeNull();
    });

    it("unwraps guregu null.Int struct form", () => {
        expect(nullableInt({ Int64: 3, Valid: true })).toBe(3);
        expect(nullableInt({ Int64: 3, Valid: false })).toBeNull();
        expect(nullableInt({ int64: 7, valid: true })).toBe(7);
    });

    it("unwraps guregu null.Value struct form", () => {
        expect(nullableInt({ V: 2, Valid: true })).toBe(2);
        expect(nullableInt({ v: 2, valid: false })).toBeNull();
    });
});
