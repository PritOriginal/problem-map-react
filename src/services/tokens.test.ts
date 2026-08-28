import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, isAccessTokenValid, saveTokens } from "./tokens";

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
