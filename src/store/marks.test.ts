import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarksService, { GetMarksResponse, Mark } from "../services/MarksService";
import marksStore, { DEFAULT_FILTERS, MARKS_FETCH_LIMIT, MARKS_SINCE_KEY } from "./marks";
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
        marksStore.total = 0;
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

    // `GET /marks` without a `limit` gets the backend's default of 100, which is exactly how
    // the map used to lose every mark past the hundredth.
    it("asks for a full page and reports a set the backend truncated", async () => {
        const getMarks = vi.spyOn(MarksService, "getMarks")
            .mockResolvedValue({ success: true, payload: { marks: [mark(1), mark(2)] }, meta: { limit: MARKS_FETCH_LIMIT, offset: 0, total: 2 } });

        await marksStore.fetch();

        expect(getMarks.mock.calls[0][0]).toMatchObject({ limit: MARKS_FETCH_LIMIT });
        expect(marksStore.total).toBe(2);
        expect(marksStore.truncated).toBe(false);

        getMarks.mockResolvedValue({ success: true, payload: { marks: [mark(1), mark(2)] }, meta: { limit: MARKS_FETCH_LIMIT, offset: 0, total: 900 } });
        await marksStore.fetch();
        expect(marksStore.truncated).toBe(true);

        // an older backend answering without `meta`: what arrived is all there is
        getMarks.mockResolvedValue({ success: true, payload: { marks: [mark(1)] } });
        await marksStore.fetch();
        expect(marksStore.total).toBe(1);
        expect(marksStore.truncated).toBe(false);
    });

    it("moves `total` with an incremental sync so the truncation notice does not go stale", async () => {
        vi.spyOn(MarksService, "getMarks")
            .mockResolvedValue({ success: true, payload: { marks: [mark(1), mark(2)] }, meta: { limit: MARKS_FETCH_LIMIT, offset: 0, total: 900 } });
        await marksStore.fetch();

        marksStore.applyChanges({ marks: [mark(3)], deleted_ids: [1], hidden_ids: [], server_time: "2026-01-01T00:00:00Z" });

        // one added, one removed: the loaded set and `total` moved by the same amount
        expect(marksStore.marks).toHaveLength(2);
        expect(marksStore.total).toBe(900);
        expect(marksStore.truncated).toBe(true);
    });

    it("still surfaces a real network failure", async () => {
        vi.spyOn(MarksService, "getMarks").mockRejectedValue(new Error("network down"));

        await marksStore.fetch();

        expect(marksStore.error).toBe("network down");
        expect(notificationsStore.error).toBe("network down");
        expect(marksStore.isLoading).toBe(false);
    });
});
