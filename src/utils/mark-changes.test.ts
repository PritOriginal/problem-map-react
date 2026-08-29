import { describe, expect, it } from "vitest";
import { applyMarkChanges } from "./mark-changes";
import type { Mark } from "../services/MarksService";

const mark = (id: number, extra: Partial<Mark> = {}): Mark => ({
    mark_id: id, name: "", geom: { type: "Point", coordinates: [0, 0] }, mark_type_id: 1, description: "", user_id: 1, mark_status_id: 2, created_at: "", updated_at: "", ...extra,
});

describe("applyMarkChanges", () => {
    it("replaces changed marks in place, appends new ones and drops deleted / hidden ids", () => {
        const current = [mark(1), mark(2), mark(3), mark(4)];
        const result = applyMarkChanges(current, {
            marks: [mark(2, { description: "upd" }), mark(5), mark(6, { hidden: true })],
            deleted_ids: [3],
            hidden_ids: [4],
            server_time: "",
        });
        expect(result.map((m) => m.mark_id)).toEqual([1, 2, 5]);
        expect(result[1].description).toBe("upd");
    });

    it("respects the active filters", () => {
        const result = applyMarkChanges([mark(1)], { marks: [mark(1, { mark_status_id: 6 }), mark(2, { mark_type_id: 9 })], deleted_ids: [], hidden_ids: [], server_time: "" }, { mark_type_ids: [1], mark_status_ids: [2] });
        expect(result).toEqual([]);
    });
});
