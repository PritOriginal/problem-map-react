import { describe, expect, it } from "vitest";
import { Check } from "../../../../../services/ChecksService";
import { Mark, MarkStatus, MarkStatusHistoryItem, MarkStatusType } from "../../../../../services/MarksService";
import { canAddCheck, groupHistory } from "./use-history-groups";

/** The dictionary as the backend serves it: `InWorkStatus` is a step inside "under review". */
const STATUSES: MarkStatus[] = [
    { mark_status_id: MarkStatusType.UnconfirmedStatus, name: "unconfirmed", parent_id: null },
    { mark_status_id: MarkStatusType.ConfirmedStatus, name: "confirmed", parent_id: null },
    { mark_status_id: MarkStatusType.UnderReviewStatus, name: "under review", parent_id: null },
    { mark_status_id: MarkStatusType.RediscoveredStatus, name: "rediscovered", parent_id: null },
    { mark_status_id: MarkStatusType.ClosedStatus, name: "closed", parent_id: null },
    { mark_status_id: MarkStatusType.RefutedStatus, name: "refuted", parent_id: null },
    { mark_status_id: MarkStatusType.InWorkStatus, name: "in work", parent_id: MarkStatusType.UnderReviewStatus },
    { mark_status_id: MarkStatusType.DuplicateStatus, name: "duplicate", parent_id: null },
];

function check(overrides: Partial<Check> = {}): Check {
    return {
        check_id: 1,
        user_id: 7,
        username: "user",
        mark_id: 1,
        result: true,
        comment: "",
        photos: [],
        created_at: "2026-05-01T10:00:00Z",
        updated_at: "2026-05-01T10:00:00Z",
        ...overrides,
    };
}

function item(id: number, statusId: number, checks?: Check[]): MarkStatusHistoryItem {
    return {
        id,
        mark_id: 1,
        old_mark_status_id: null,
        new_mark_status_id: statusId,
        changed_at: `2026-05-0${id}T10:00:00Z`,
        checks,
    };
}

function mark(overrides: Partial<Mark> = {}): Mark {
    return {
        mark_id: 1,
        name: "mark",
        geom: { type: "Point", coordinates: [0, 0] },
        mark_type_id: 1,
        description: "",
        user_id: 42,
        mark_status_id: MarkStatusType.ConfirmedStatus,
        created_at: "2026-05-01T10:00:00Z",
        updated_at: "2026-05-01T10:00:00Z",
        ...overrides,
    };
}

describe("groupHistory", () => {
    it("returns nothing for an empty history", () => {
        expect(groupHistory([], STATUSES)).toEqual([]);
    });

    it("gives every parentless status a layer of its own, in the order they arrived", () => {
        const unconfirmed = item(1, MarkStatusType.UnconfirmedStatus);
        const confirmed = item(2, MarkStatusType.ConfirmedStatus);
        expect(groupHistory([unconfirmed, confirmed], STATUSES)).toEqual([[unconfirmed], [confirmed]]);
    });

    it("folds a status with a parent_id into the layer opened before it", () => {
        const confirmed = item(1, MarkStatusType.ConfirmedStatus);
        const review = item(2, MarkStatusType.UnderReviewStatus);
        const inWork = item(3, MarkStatusType.InWorkStatus);
        expect(groupHistory([confirmed, review, inWork], STATUSES)).toEqual([
            [confirmed],
            [review, inWork],
        ]);
    });

    it("drops leading child statuses that no layer opened", () => {
        const inWork = item(1, MarkStatusType.InWorkStatus);
        const closed = item(2, MarkStatusType.ClosedStatus);
        expect(groupHistory([inWork, closed], STATUSES)).toEqual([[closed]]);
    });

    it("keeps a single unclosed layer as one group", () => {
        const confirmed = item(1, MarkStatusType.ConfirmedStatus);
        expect(groupHistory([confirmed], STATUSES)).toEqual([[confirmed]]);
    });

    it("treats a status missing from the dictionary as opening a layer", () => {
        const unknown = item(1, 999);
        expect(groupHistory([unknown], [])).toEqual([[unknown]]);
    });
});

describe("canAddCheck", () => {
    const groups = (...items: MarkStatusHistoryItem[][]) => items;

    it("offers the button to an anonymous visitor, who meets the sign-in wall behind it", () => {
        const layer = [item(1, MarkStatusType.ClosedStatus, [check({ user_id: 0 })])];
        expect(canAddCheck(mark({ mark_status_id: MarkStatusType.ClosedStatus }), groups(layer), 0)).toBe(true);
    });

    it("offers the button while the history has not arrived yet", () => {
        expect(canAddCheck(mark(), [], 7)).toBe(true);
    });

    it("allows a check on an open mark the user has not checked", () => {
        expect(canAddCheck(mark(), groups([item(1, MarkStatusType.ConfirmedStatus, [])]), 7)).toBe(true);
    });

    it("allows a check by the author of the mark, who is not treated apart", () => {
        expect(canAddCheck(mark({ user_id: 7 }), groups([item(1, MarkStatusType.ConfirmedStatus)]), 7)).toBe(true);
    });

    it.each([
        ["closed", MarkStatusType.ClosedStatus],
        ["refuted", MarkStatusType.RefutedStatus],
        ["duplicate", MarkStatusType.DuplicateStatus],
    ])("refuses a check on a %s mark", (_name, statusId) => {
        const layer = [item(1, statusId)];
        expect(canAddCheck(mark({ mark_status_id: statusId }), groups(layer), 7)).toBe(false);
    });

    it("refuses a second check in the current layer", () => {
        const layer = [item(1, MarkStatusType.ConfirmedStatus, [check({ user_id: 7 })])];
        expect(canAddCheck(mark(), groups(layer), 7)).toBe(false);
    });

    it("finds the user's check in any step of the current layer, not only the first", () => {
        const layer = [
            item(1, MarkStatusType.UnderReviewStatus),
            item(2, MarkStatusType.InWorkStatus, [check({ user_id: 7 })]),
        ];
        expect(canAddCheck(mark({ mark_status_id: MarkStatusType.UnderReviewStatus }), groups(layer), 7)).toBe(false);
    });

    it("ignores checks the user left in earlier layers -- the mark has moved on", () => {
        const older = [item(1, MarkStatusType.UnconfirmedStatus, [check({ user_id: 7 })])];
        const current = [item(2, MarkStatusType.ConfirmedStatus, [check({ user_id: 8 })])];
        expect(canAddCheck(mark(), groups(older, current), 7)).toBe(true);
    });

    it("ignores another user's check in the current layer", () => {
        const layer = [item(1, MarkStatusType.ConfirmedStatus, [check({ user_id: 8 })])];
        expect(canAddCheck(mark(), groups(layer), 7)).toBe(true);
    });

    it("survives a layer whose items carry no checks field at all", () => {
        expect(canAddCheck(mark(), groups([item(1, MarkStatusType.ConfirmedStatus)]), 7)).toBe(true);
    });
});
