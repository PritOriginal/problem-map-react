import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarksService, { GetMarksResponse, Mark } from "../services/MarksService";
import marksStore, { DEFAULT_FILTERS, MARKS_SINCE_KEY } from "./marks";
import notificationsStore from "./notifications";

function mark(id: number): Mark {
    return {
        mark_id: id,
        name: `m${id}`,
        geom: { type: "Point", coordinates: [1, 2] },
        mark_type_id: 1,
        description: "",
        user_id: 1,
        mark_status_id: 1,
        created_at: "",
        updated_at: "",
    };
}

interface Deferred {
    promise: Promise<GetMarksResponse>;
    resolve: (marks: Mark[]) => void;
    reject: (error: unknown) => void;
}

/** A `getMarks` answer resolved by hand, so a test controls which request returns first. */
function deferred(): Deferred {
    let resolve!: (marks: Mark[]) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<GetMarksResponse>((res, rej) => {
        resolve = (marks) => res({ success: true, payload: { marks } });
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("marksStore.fetch", () => {
    beforeEach(() => {
        localStorage.clear();
        marksStore.marks = [];
        marksStore.error = null;
        marksStore.isLoading = false;
        marksStore.setFilters(DEFAULT_FILTERS);
        notificationsStore.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps the newest response even when an older one returns last", async () => {
        const slow = deferred();
        const fast = deferred();
        const getMarks = vi.spyOn(MarksService, "getMarks")
            .mockImplementationOnce(() => slow.promise)
            .mockImplementationOnce(() => fast.promise);

        const first = marksStore.fetch();
        const second = marksStore.fetch();

        fast.resolve([mark(2)]);
        await second;
        slow.resolve([mark(1)]);
        await first;

        expect(getMarks).toHaveBeenCalledTimes(2);
        expect(marksStore.marks.map((m) => m.mark_id)).toEqual([2]);
        expect(marksStore.isLoading).toBe(false);
    });

    it("aborts the superseded request and never reports the abort to the user", async () => {
        const signals: (AbortSignal | undefined | null)[] = [];
        const slow = deferred();
        const pending = deferred();
        vi.spyOn(MarksService, "getMarks").mockImplementation((_req, init) => {
            signals.push(init?.signal);
            return signals.length === 1 ? slow.promise : pending.promise;
        });

        const first = marksStore.fetch();
        marksStore.fetch();
        expect(signals[0]?.aborted).toBe(true);

        // the aborted request rejects the way `fetch` does
        slow.reject(new DOMException("The operation was aborted.", "AbortError"));
        await first;

        expect(notificationsStore.error).toBeNull();
        expect(marksStore.error).toBeNull();
        // the successor is still in flight: its loading state must survive the abort
        expect(marksStore.isLoading).toBe(true);

        pending.resolve([mark(3)]);
    });

    it("does not move the `since` bookmark with a stale response", async () => {
        const slow = deferred();
        const fast = deferred();
        vi.spyOn(MarksService, "getMarks")
            .mockImplementationOnce(() => slow.promise)
            .mockImplementationOnce(() => fast.promise);

        const first = marksStore.fetch();
        const second = marksStore.fetch();

        fast.resolve([mark(2)]);
        await second;
        const since = localStorage.getItem(MARKS_SINCE_KEY);
        expect(since).not.toBeNull();

        slow.resolve([mark(1)]);
        await first;
        expect(localStorage.getItem(MARKS_SINCE_KEY)).toBe(since);
    });

    it("still surfaces a real network failure", async () => {
        vi.spyOn(MarksService, "getMarks").mockRejectedValue(new Error("network down"));

        await marksStore.fetch();

        expect(marksStore.error).toBe("network down");
        expect(notificationsStore.error).toBe("network down");
        expect(marksStore.isLoading).toBe(false);
    });
});
