import { ApiError, IResponse, parseResponse } from "./http";
import { ensureAccessToken, getAccessToken, refreshTokens, signOut } from "./tokens";
import { getLang, t } from "../i18n";

export type { IResponse } from "./http";

class BaseService {
    /** Performs a request and parses the response; rejects with ApiError on failure. */
    protected request<T extends IResponse = IResponse>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
        return fetch(input, withLang(init)).then((response) => parseResponse<T>(response));
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

/** Adds `Accept-Language` (current UI language) so dictionaries come back localized. */
export function withLang(init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers);
    headers.set("Accept-Language", getLang());
    return { ...init, headers };
}

export default BaseService;
