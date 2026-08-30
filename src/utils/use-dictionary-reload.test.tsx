import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";

import { useDictionaryReload } from "./use-dictionary-reload";
import { useBadgeCatalogue } from "./badges";
import { setLang } from "../i18n";
import { resetStores } from "../test/render";
import { envelope, jsonResponse } from "../test/fetch";
import user from "../store/user";
import { clearTokens, saveTokens } from "../services/tokens";
import markTypesStore from "../store/mark-types";
import markStatusesStore from "../store/mark-statuses";
import organizationsStore from "../store/organizations";
import adminBoundariesStore from "../store/admin-boundaries";

/**
 * The localized dictionaries anyone can read, by the path they come from. Spelling them
 * out is the point of the test: a dictionary added later without a reload shows up as a
 * missing line here rather than as district names silently stuck in the old language.
 *
 * `/api/tasks/statuses` is the sixth one; it is behind a sign-in, so it has its own test.
 */
const PUBLIC_DICTIONARY_PATHS = [
    "/api/marks/types",
    "/api/marks/statuses",
    "/api/organizations",
    // the boundary names arrive twice over: once as the geometry-less index
    // (`?geometry=false`, see `MapService.getAdminBoundaryIndex`) and once with the counts
    "/api/map/admin-boundaries",
    "/api/map/admin-boundaries/marks/count",
];

interface Call {
    path: string;
    lang: string | null;
}

/** Records every request path together with the `Accept-Language` it carried. */
function recordFetch(): Call[] {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://localhost");
        const headers = new Headers(init?.headers);
        calls.push({ path: url.pathname, lang: headers.get("Accept-Language") });
        // deliberately no ETag on the answer: what matters here is which requests go out
        return jsonResponse(envelope([]));
    }));
    return calls;
}

function pathsOf(calls: Call[]): string[] {
    return calls.map((call) => call.path);
}

/**
 * A signed-in user, tokens included. The token matters as much as the store: without one
 * the first authenticated request the sign-in sets off fails with a 401, and the sign-out
 * that follows would put `user.id` back to 0 before the language ever changed.
 */
function signIn(): void {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    saveTokens(`header.${payload}.signature`, "refresh-token");
    runInAction(() => {
        user.id = 7;
    });
}

describe("useDictionaryReload", () => {
    beforeEach(() => {
        resetStores();
        clearTokens();
        setLang("ru");
    });

    afterEach(() => {
        // unmount before the language goes back, or the hook would fire once more
        // against the real `fetch` and fill the output with URL errors
        cleanup();
        setLang("ru");
        vi.unstubAllGlobals();
        clearTokens();
    });

    it("asks for every localized dictionary again when the language changes", async () => {
        const calls = recordFetch();
        renderHook(() => useDictionaryReload());

        // mounting is not a language change: each screen loads what it needs itself
        expect(calls).toHaveLength(0);

        act(() => setLang("en"));

        await waitFor(() => {
            expect(pathsOf(calls)).toEqual(expect.arrayContaining(PUBLIC_DICTIONARY_PATHS));
        });
        for (const call of calls) {
            expect(call.lang).toBe("en");
        }
    });

    it("reloads the load-once dictionaries, whose guard would otherwise swallow the call", async () => {
        const calls = recordFetch();
        renderHook(() => useDictionaryReload());

        // mark types, mark statuses, organizations and the boundaries all load once and
        // then answer from memory; only `force` gets past that
        await act(async () => {
            await Promise.all([
                markTypesStore.fetch(),
                markStatusesStore.fetch(),
                organizationsStore.fetch(),
                adminBoundariesStore.fetchBoundaries(),
            ]);
        });
        calls.length = 0;

        act(() => setLang("en"));

        await waitFor(() => {
            expect(pathsOf(calls)).toEqual(expect.arrayContaining([
                "/api/marks/types",
                "/api/marks/statuses",
                "/api/organizations",
                "/api/map/admin-boundaries",
                "/api/map/admin-boundaries/marks/count",
            ]));
        });
    });

    it("leaves the task statuses alone while nobody is signed in", async () => {
        const calls = recordFetch();
        renderHook(() => useDictionaryReload());

        act(() => setLang("en"));

        await waitFor(() => {
            expect(pathsOf(calls)).toEqual(expect.arrayContaining(PUBLIC_DICTIONARY_PATHS));
        });
        expect(pathsOf(calls)).not.toContain("/api/tasks/statuses");
    });

    it("reloads the task statuses for a signed-in user", async () => {
        signIn();
        const calls = recordFetch();
        renderHook(() => useDictionaryReload());

        act(() => setLang("en"));

        await waitFor(() => expect(pathsOf(calls)).toContain("/api/tasks/statuses"));
    });

    it("does not re-fetch when the language is set to the one already in use", () => {
        const calls = recordFetch();
        renderHook(() => useDictionaryReload());

        act(() => setLang("ru"));

        expect(calls).toHaveLength(0);
    });
});

describe("useBadgeCatalogue", () => {
    beforeEach(() => {
        setLang("ru");
    });

    afterEach(() => {
        cleanup();
        setLang("ru");
        vi.unstubAllGlobals();
    });

    it("reloads the catalogue when the language changes", async () => {
        const calls = recordFetch();
        renderHook(() => useBadgeCatalogue());

        await waitFor(() => expect(pathsOf(calls)).toEqual(["/api/badges"]));

        act(() => setLang("en"));

        await waitFor(() => expect(pathsOf(calls)).toEqual(["/api/badges", "/api/badges"]));
        expect(calls[1].lang).toBe("en");
    });
});
