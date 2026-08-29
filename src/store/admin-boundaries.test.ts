import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminBoundariesStore from "./admin-boundaries";
import { jsonResponse } from "../test/fetch";

/**
 * `GET /map/admin-boundaries` returns full polygon geometry — the heaviest response in the app.
 * The map loads it once; the analytics and leaderboard panels want the same list only to fill a
 * district `<select>`, so the store must not go to the network for them again.
 */
describe("adminBoundariesStore.fetchBoundaries", () => {
    const boundaries = { admin_boundaries: [{ id: 1, name: "Центральный", admin_level: 9, geom: null }] };
    let fetchMock: ReturnType<typeof vi.fn>;

    function ok(): Response {
        return jsonResponse({ success: true, payload: boundaries });
    }

    /** Back to a pristine store: the singleton is shared with every other test in the file. */
    function reset(): void {
        const store = adminBoundariesStore as unknown as Record<string, unknown>;
        store.loadedBoundaries = false;
        store.boundariesRequest = null;
        adminBoundariesStore.boundaries = [];
        adminBoundariesStore.errorBoundaries = null;
        adminBoundariesStore.isLoadingBoundaries = false;
    }

    beforeEach(() => {
        reset();
        fetchMock = vi.fn(async () => ok());
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        reset();
    });

    it("shares one request between concurrent callers", async () => {
        await Promise.all([adminBoundariesStore.fetchBoundaries(), adminBoundariesStore.fetchBoundaries()]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(adminBoundariesStore.boundaries).toHaveLength(1);
        expect(adminBoundariesStore.isLoadingBoundaries).toBe(false);
    });

    it("does not re-fetch once loaded, and re-fetches on force", async () => {
        await adminBoundariesStore.fetchBoundaries();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await adminBoundariesStore.fetchBoundaries();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await adminBoundariesStore.fetchBoundaries(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(adminBoundariesStore.boundaries).toHaveLength(1);
    });

    it("does not stick after a failed request: the next caller tries again", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network down"));

        await adminBoundariesStore.fetchBoundaries();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(adminBoundariesStore.boundaries).toEqual([]);
        expect(adminBoundariesStore.errorBoundaries).not.toBeNull();

        await adminBoundariesStore.fetchBoundaries();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(adminBoundariesStore.boundaries).toHaveLength(1);
        expect(adminBoundariesStore.errorBoundaries).toBeNull();
    });
});
