import { jwtDecode } from "jwt-decode";

export type Role = "user" | "moderator" | "admin" | "service";

export const ROLES: readonly Role[] = ["user", "moderator", "admin", "service"];

/** Normalizes an arbitrary value to a known role; unknown values fall back to "user". */
export function parseRole(value: unknown): Role {
    return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as Role) : "user";
}

/** Reads the `role` claim from a JWT access token. Malformed tokens or missing claims yield "user". */
export function getRoleFromToken(token: string | null): Role {
    if (!token) {
        return "user";
    }
    try {
        const payload = jwtDecode<{ role?: unknown }>(token);
        return parseRole(payload.role);
    } catch {
        return "user";
    }
}

export function canModerate(role: Role): boolean {
    return role === "moderator" || role === "admin";
}

/** Organization staff: sees the service desk (`/org`). */
export function isService(role: Role): boolean {
    return role === "service";
}
