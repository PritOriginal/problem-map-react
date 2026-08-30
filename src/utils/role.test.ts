import { describe, expect, it } from "vitest";
import { canModerate, getRoleFromToken, parseRole } from "./role";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

describe("parseRole", () => {
    it("accepts known roles", () => {
        expect(parseRole("user")).toBe("user");
        expect(parseRole("moderator")).toBe("moderator");
        expect(parseRole("admin")).toBe("admin");
    });

    it("falls back to user for unknown values", () => {
        expect(parseRole("root")).toBe("user");
        expect(parseRole("")).toBe("user");
        expect(parseRole(undefined)).toBe("user");
        expect(parseRole(42)).toBe("user");
        expect(parseRole(null)).toBe("user");
    });
});

describe("getRoleFromToken", () => {
    it("reads the role claim", () => {
        expect(getRoleFromToken(makeJwt({ sub: "1", role: "moderator" }))).toBe("moderator");
        expect(getRoleFromToken(makeJwt({ sub: "1", role: "admin" }))).toBe("admin");
    });

    it("defaults to user when the claim is missing, unknown or the token is malformed", () => {
        expect(getRoleFromToken(makeJwt({ sub: "1" }))).toBe("user");
        expect(getRoleFromToken(makeJwt({ sub: "1", role: "superuser" }))).toBe("user");
        expect(getRoleFromToken("not-a-jwt")).toBe("user");
        expect(getRoleFromToken("")).toBe("user");
        expect(getRoleFromToken(null)).toBe("user");
    });
});

describe("canModerate", () => {
    it("allows moderator and admin only", () => {
        expect(canModerate("user")).toBe(false);
        expect(canModerate("moderator")).toBe(true);
        expect(canModerate("admin")).toBe(true);
    });
});
