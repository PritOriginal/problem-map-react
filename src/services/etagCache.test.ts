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

/**
 * The backend localizes dictionaries through `Accept-Language` (`withLang`), so a body cached
 * for one language must never be served to another. The cache key therefore carries the
 * language (`etag:v2:<lang>:<url>`) — this pins that behaviour down.
 */
describe("ETag cache is keyed by language", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("does not serve the russian body after the language switched to english", async () => {
        // one fresh module registry for the service and for the language store it reads
        const marksService = (await import("./MarksService")).default;
        const { setLang } = await import("../i18n");
        setLang("ru");

        const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const lang = new Headers(init?.headers).get("Accept-Language");
            const name = lang === "en" ? "Trash" : "Мусор";
            return jsonResponse(
                { success: true, payload: { mark_types: [{ id: 1, mark_type_id: 1, code: "trash", name }] } },
                { headers: { ETag: `"${lang}"` } },
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        expect((await marksService.getMarkTypes()).payload[0].name).toBe("Мусор");
        expect(localStorage.getItem("etag:v2:ru:/api/marks/types")).not.toBeNull();
        expect(localStorage.getItem("etag:v2:en:/api/marks/types")).toBeNull();

        setLang("en");
        const res = await marksService.getMarkTypes();

        // a request really went out, and without the russian entry's If-None-Match
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(new Headers(init.headers).get("If-None-Match")).toBeNull();
        expect(new Headers(init.headers).get("Accept-Language")).toBe("en");
        expect(res.payload[0].name).toBe("Trash");

        // the russian body stayed under its own key instead of being overwritten
        expect(localStorage.getItem("etag:v2:ru:/api/marks/types")).toContain("Мусор");

        setLang("ru");
    });
});
