import { ApiError, IResponse, parseResponse } from "./http";
import { ensureAccessToken, getAccessToken, refreshTokens, signOut } from "./tokens";
import { getLang, t } from "../i18n";

export type { IResponse } from "./http";
export { unwrapList, unwrapOne } from "./http";

class BaseService {
    /** Performs a request and parses the response; rejects with ApiError on failure. */
    protected request<T extends IResponse = IResponse>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
        return fetch(input, withLang(init)).then((response) => parseResponse<T>(response));
    }

    /**
     * GET with `If-None-Match` for read-only dictionaries (backend integration/wave-5 sends `ETag`).
     * The last body and its ETag are kept in localStorage per URL + language; a 304 (or an empty
     * body from a cache layer) yields the stored body, a 200 replaces it.
     */
    protected async requestCached<T extends IResponse = IResponse>(input: string, init: RequestInit = {}): Promise<T> {
        const key = `${ETAG_PREFIX}${getLang()}:${input}`;
        const stored = readEtagEntry<T>(key);
        const headers = new Headers(withLang(init).headers);
        if (stored) {
            headers.set("If-None-Match", stored.etag);
        }
        const response = await fetch(input, { ...init, headers });
        if (response.status === 304 && stored) {
            return stored.body;
        }
        const body = await parseResponse<T>(response);
        const etag = response.headers.get("ETag");
        if (etag) {
            writeEtagEntry(key, { etag, body });
        }
        return body;
    }

    /** Same as `request`, but authenticated (see `fetchWithAuth`). */
    protected requestWithAuth<T extends IResponse = IResponse>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
        return this.fetchWithAuth(input, init).then((response) => parseResponse<T>(response));
    }

    /**
     * Performs an authenticated request. Ensures a valid access token first;
     * on a 401 response refreshes the tokens once and retries the request.
     * If the tokens were already rotated by a concurrent request, the retry reuses them
     * instead of refreshing again. If the refresh is rejected, tokens and the user store
     * are cleared and ApiError(401) is thrown; a second 401 after the retry also signs out.
     */
    protected async fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
        const token = await ensureAccessToken();
        let response = await fetch(input, this.withBearer(init, token));

        if (response.status === 401) {
            if (getAccessToken() === token && !(await refreshTokens())) {
                throw new ApiError(t("common.unauthorized"), 401);
            }
            response = await fetch(input, this.withBearer(init, await ensureAccessToken()));
            if (response.status === 401) {
                signOut();
            }
        }

        return response;
    }

    private withBearer(init: RequestInit, token: string): RequestInit {
        const withLangInit = withLang(init);
        const headers = new Headers(withLangInit.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return { ...withLangInit, headers };
    }
}

/**
 * Versioned so a body cached by an older build (which stored a different payload shape,
 * e.g. bare lists) is never served to newer code; stale versions are purged on first use.
 */
const ETAG_PREFIX = "etag:v2:";
const ETAG_LEGACY_PREFIX = "etag:";

/** Drops entries written under an older `ETAG_PREFIX` (a handful of keys at most, so it runs per read). */
function purgeStaleEtagEntries(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(ETAG_LEGACY_PREFIX) && !key.startsWith(ETAG_PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // ignore
    }
}
/**
 * localStorage is ~5 MB per origin and shared with the tokens: bodies above this size (e.g. admin
 * boundaries with full geometry) are not cached, the request then simply goes without `If-None-Match`.
 */
const ETAG_MAX_ENTRY_CHARS = 512_000;

interface EtagEntry<T> {
    etag: string;
    body: T;
}

function readEtagEntry<T>(key: string): EtagEntry<T> | null {
    purgeStaleEtagEntries();
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<EtagEntry<T>>;
        return typeof parsed.etag === "string" && parsed.body !== undefined ? (parsed as EtagEntry<T>) : null;
    } catch {
        return null;
    }
}

function writeEtagEntry<T>(key: string, entry: EtagEntry<T>): void {
    try {
        const raw = JSON.stringify(entry);
        if (raw.length > ETAG_MAX_ENTRY_CHARS) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(key, raw);
    } catch {
        // storage full / unavailable: the next request simply goes without If-None-Match
    }
}

/** Drops every cached ETag body (e.g. on sign-out). */
export function clearEtagCache(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(ETAG_LEGACY_PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // ignore
    }
}

/**
 * Adds `Idempotency-Key` (backend integration/wave-5) so a retried `POST` — e.g. from the
 * offline queue — is not applied twice.
 */
export function withIdempotencyKey(init: RequestInit = {}, key: string | undefined): RequestInit {
    if (!key) {
        return init;
    }
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", key);
    return { ...init, headers };
}

/** Adds `Accept-Language` (current UI language) so dictionaries come back localized. */
export function withLang(init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers);
    headers.set("Accept-Language", getLang());
    return { ...init, headers };
}

export default BaseService;
