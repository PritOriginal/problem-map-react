import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { usePagedData } from "./use-paged-data";
import notificationsStore from "../store/notifications";

/** A promise plus the handles to settle it from the test. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

/** A backend holding `total` rows, answering `limit` of them from `offset`. */
function pageOf(total: number, limit: number, offset: number): { items: string[]; meta: { limit: number; offset: number; total: number } } {
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => `row-${offset + i}`);
    return { items, meta: { limit, offset, total } };
}

describe("usePagedData", () => {
    beforeEach(() => {
        notificationsStore.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        notificationsStore.clear();
        vi.restoreAllMocks();
    });

    it("loads the first page and reports what is left from meta.total", async () => {
        const { result } = renderHook(() => usePagedData(async (offset) => pageOf(7, 3, offset), []));

        await waitFor(() => expect(result.current.items).toHaveLength(3));
        expect(result.current.total).toBe(7);
        expect(result.current.remaining).toBe(4);
        expect(result.current.hasMore).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });

    it("appends further pages instead of replacing them, and hides the button at the end", async () => {
        const offsets: number[] = [];
        const { result } = renderHook(() => usePagedData(async (offset) => {
            offsets.push(offset);
            return pageOf(7, 3, offset);
        }, []));

        await waitFor(() => expect(result.current.items).toHaveLength(3));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.items).toHaveLength(6));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.items).toHaveLength(7));

        expect(offsets).toEqual([0, 3, 6]);
        expect(result.current.items).toEqual(["row-0", "row-1", "row-2", "row-3", "row-4", "row-5", "row-6"]);
        expect(result.current.hasMore).toBe(false);
        expect(result.current.remaining).toBe(0);
    });

    it("a page already read stays on screen while the next one is coming", async () => {
        const gate = deferred<void>();
        const { result } = renderHook(() => usePagedData(async (offset) => {
            if (offset > 0) {
                await gate.promise;
            }
            return pageOf(6, 3, offset);
        }, []));

        await waitFor(() => expect(result.current.items).toHaveLength(3));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
        // the rows already read are untouched while the request is in flight
        expect(result.current.items).toHaveLength(3);

        await act(async () => {
            gate.resolve();
            await gate.promise;
        });
        await waitFor(() => expect(result.current.items).toHaveLength(6));
        expect(result.current.isLoadingMore).toBe(false);
    });

    it("two fast clicks ask for the same offset once: no page is duplicated or skipped", async () => {
        const offsets: number[] = [];
        const gates: { promise: Promise<void>; resolve: (value: void) => void }[] = [];
        const { result } = renderHook(() => usePagedData(async (offset, signal) => {
            offsets.push(offset);
            if (offset > 0) {
                const gate = deferred<void>();
                gates.push(gate);
                await gate.promise;
                if (signal.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }
            }
            return pageOf(9, 3, offset);
        }, []));

        await waitFor(() => expect(result.current.items).toHaveLength(3));
        act(() => result.current.loadMore());
        act(() => result.current.loadMore());

        await act(async () => {
            gates.forEach((gate) => gate.resolve());
            await Promise.all(gates.map((gate) => gate.promise));
        });
        await waitFor(() => expect(result.current.items).toHaveLength(6));

        // the second click superseded the first: both asked for offset 3, and only one landed
        expect(offsets).toEqual([0, 3, 3]);
        expect(result.current.items).toEqual(["row-0", "row-1", "row-2", "row-3", "row-4", "row-5"]);
    });

    it("a change of deps starts over at offset 0 rather than appending to the old filter", async () => {
        const calls: [string, number][] = [];
        const { result, rerender } = renderHook(({ filter }: { filter: string }) => usePagedData(async (offset) => {
            calls.push([filter, offset]);
            return { items: [`${filter}-${offset}`], meta: { limit: 1, offset, total: 5 } };
        }, [filter]), { initialProps: { filter: "a" } });

        await waitFor(() => expect(result.current.items).toEqual(["a-0"]));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.items).toEqual(["a-0", "a-1"]));

        rerender({ filter: "b" });
        await waitFor(() => expect(result.current.items).toEqual(["b-0"]));
        expect(calls).toEqual([["a", 0], ["a", 1], ["b", 0]]);
        expect(result.current.isLoadingMore).toBe(false);
    });

    it("reload re-reads from the first page", async () => {
        const offsets: number[] = [];
        const { result } = renderHook(() => usePagedData(async (offset) => {
            offsets.push(offset);
            return pageOf(9, 3, offset);
        }, []));

        await waitFor(() => expect(result.current.items).toHaveLength(3));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.items).toHaveLength(6));
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.items).toHaveLength(3));
        expect(offsets).toEqual([0, 3, 0]);
    });

    it("without meta there is nothing to ask for: no button, no total", async () => {
        const { result } = renderHook(() => usePagedData(async () => ({ items: ["only"] }), []));

        await waitFor(() => expect(result.current.items).toEqual(["only"]));
        expect(result.current.total).toBeUndefined();
        expect(result.current.hasMore).toBe(false);
        expect(result.current.remaining).toBe(0);
    });

    it("enabled: false runs nothing and yields an empty list", () => {
        const fetchPage = vi.fn(async () => ({ items: ["x"] }));
        const { result } = renderHook(() => usePagedData(fetchPage, [], { enabled: false }));

        expect(fetchPage).not.toHaveBeenCalled();
        expect(result.current.items).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it("a rejection reaches `error` and the banner, the same way useAsyncData reports one", async () => {
        const boom = new Error("boom");
        const { result } = renderHook(() => usePagedData<string>(
            () => Promise.reject(boom),
            [],
            { errorMessage: "не вышло" },
        ));

        await waitFor(() => expect(result.current.error).toBe(boom));
        expect(result.current.items).toEqual([]);
        expect(notificationsStore.error).toBe("boom");
    });
});
