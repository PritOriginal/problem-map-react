import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/fetch";

/**
 * The legacy-prefix sweep walks the whole of localStorage (tokens and mobx-persist keys
 * included), so it must happen once per session — not on every cached GET.
 */
describe("stale ETag purge", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("sweeps the storage on import and never again on subsequent cached reads", async () => {
        localStorage.setItem("etag:ru:/api/badges", JSON.stringify({ etag: "old", body: {} }));
        localStorage.setItem("mobx-persist-store_user", "{}");

        const keySpy = vi.spyOn(Storage.prototype, "key");
        // fresh module registry: the module-level purge runs during this import
        const usersService = (await import("./UsersService")).default;

        expect(keySpy).toHaveBeenCalled();
        expect(localStorage.getItem("etag:ru:/api/badges")).toBeNull();
        expect(localStorage.getItem("mobx-persist-store_user")).not.toBeNull();

        keySpy.mockClear();
        const fetchMock = vi.fn(async () => jsonResponse({ success: true, payload: { badges: [] } }));
        vi.stubGlobal("fetch", fetchMock);

        for (let i = 0; i < 5; i++) {
            await usersService.getBadges();
        }

        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(keySpy).not.toHaveBeenCalled();
        keySpy.mockRestore();
    });
});
