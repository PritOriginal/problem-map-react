import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, isAccessTokenValid, refreshTokens, saveTokens } from "./tokens";
import { ApiError } from "./http";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

describe("isAccessTokenValid", () => {
    const nowMs = 1_700_000_000_000; // ms
    const nowSec = nowMs / 1000;

    it("treats exp as seconds, not milliseconds", () => {
        // exp one hour in the future (seconds)
        expect(isAccessTokenValid(makeJwt({ exp: nowSec + 3600 }), nowMs)).toBe(true);
        // exp one hour in the past (seconds) - would look valid if compared with ms
        expect(isAccessTokenValid(makeJwt({ exp: nowSec - 3600 }), nowMs)).toBe(false);
    });

    it("rejects tokens expiring within the leeway", () => {
        expect(isAccessTokenValid(makeJwt({ exp: nowSec + 1 }), nowMs)).toBe(false);
    });

    it("rejects missing, malformed or exp-less tokens", () => {
        expect(isAccessTokenValid(null, nowMs)).toBe(false);
        expect(isAccessTokenValid("", nowMs)).toBe(false);
        expect(isAccessTokenValid("not-a-jwt", nowMs)).toBe(false);
        expect(isAccessTokenValid(makeJwt({ sub: "1" }), nowMs)).toBe(false);
    });
});

describe("token storage", () => {
    beforeEach(() => localStorage.clear());

    it("saves and clears both tokens", () => {
        saveTokens("a", "r");
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("a");
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("r");
        clearTokens();
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });
});

describe("refreshTokens", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => vi.unstubAllGlobals());

    function jsonResponse(body: unknown, status: number): Response {
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }

    it("saves the new pair on success and shares one in-flight request", async () => {
        saveTokens("old-a", "old-r");
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse({ success: true, payload: { access_token: "new-a", refresh_token: "new-r" } }, 200),
        );
        vi.stubGlobal("fetch", fetchMock);

        const [a, b] = await Promise.all([refreshTokens(), refreshTokens()]);
        expect(a).toBe(true);
        expect(b).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("new-a");
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("new-r");
    });

    it("clears tokens when the backend rejects the refresh token", async () => {
        saveTokens("old-a", "old-r");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            jsonResponse({ success: false, error: { message: "failed refresh tokens" } }, 401),
        ));

        await expect(refreshTokens()).resolves.toBe(false);
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it("keeps tokens and rejects on a transport or server error", async () => {
        saveTokens("old-a", "old-r");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        await expect(refreshTokens()).rejects.toThrow("Failed to fetch");
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("old-r");

        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            jsonResponse({ success: false, error: { message: "failed refresh tokens" } }, 500),
        ));
        await expect(refreshTokens()).rejects.toBeInstanceOf(ApiError);
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("old-r");
    });
});
