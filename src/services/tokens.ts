import { jwtDecode } from "jwt-decode";
import { ApiError, IResponse, parseResponse } from "./http";
import user from "../store/user";
import { getRoleFromToken } from "../utils/role";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

/** Safety margin (in ms) so a token about to expire is refreshed in advance. */
const EXP_LEEWAY_MS = 5_000;

interface RefreshTokensResponse extends IResponse {
    payload: {
        access_token: string;
        refresh_token: string;
    };
}

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Clears tokens and resets the persisted user store. */
export function signOut(): void {
    clearTokens();
    user.resetUser();
}

/**
 * Checks whether a JWT access token is still valid.
 * `exp` in a JWT is in seconds since epoch, `nowMs` is in milliseconds.
 */
export function isAccessTokenValid(token: string | null, nowMs: number = Date.now()): boolean {
    if (!token) {
        return false;
    }
    try {
        const payload = jwtDecode(token);
        if (payload.exp === undefined) {
            return false;
        }
        return payload.exp * 1000 > nowMs + EXP_LEEWAY_MS;
    } catch {
        return false;
    }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Refreshes the token pair using the stored refresh token.
 * Resolves `true` on success. Resolves `false` when the backend rejects the refresh token
 * (or there is none) — in that case tokens and the user store are cleared.
 * Rejects on transport / server errors, keeping the stored tokens so a transient
 * failure does not sign the user out.
 * Concurrent calls share one in-flight request.
 */
export function refreshTokens(): Promise<boolean> {
    if (refreshInFlight) {
        return refreshInFlight;
    }
    refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (refreshToken === null) {
        signOut();
        return false;
    }

    try {
        const response = await fetch("/api/auth/tokens/refresh", {
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=utf-8",
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await parseResponse<RefreshTokensResponse>(response);
        saveTokens(data.payload.access_token, data.payload.refresh_token);
        // the persisted role is restored asynchronously; set ours only after that so it is not overwritten
        const role = getRoleFromToken(data.payload.access_token);
        user.hydrated.then(() => user.setRole(role));
        return true;
    } catch (error) {
        console.error("Failed to refresh tokens:", error);
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            signOut();
            return false;
        }
        throw error;
    }
}

/**
 * Returns a valid access token, refreshing it if needed.
 * Throws ApiError(401) when the user cannot be authorized.
 */
export async function ensureAccessToken(): Promise<string> {
    let token = getAccessToken();
    if (!isAccessTokenValid(token)) {
        const refreshed = await refreshTokens();
        token = refreshed ? getAccessToken() : null;
    }
    if (!token) {
        throw new ApiError("Требуется авторизация", 401);
    }
    return token;
}
