import { ApiError, IResponse, parseResponse } from "./http";
import { ensureAccessToken, refreshTokens, signOut } from "./tokens";

export type { IResponse } from "./http";
export { ApiError } from "./http";

class BaseService {
    /** Parses a response; rejects with ApiError on failure. */
    protected getResponse<T extends IResponse = IResponse>(response: Response): Promise<T> {
        return parseResponse<T>(response);
    }

    /** Returns a valid access token, refreshing it if needed (throws ApiError(401) otherwise). */
    protected ensureAccessToken(): Promise<string> {
        return ensureAccessToken();
    }

    /**
     * Performs an authenticated request. Ensures a valid access token first;
     * on a 401 response refreshes the tokens once and retries the request.
     * If the refresh fails, tokens and the user store are cleared and the error is rethrown.
     */
    protected async fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
        const token = await this.ensureAccessToken();
        let response = await fetch(input, this.withBearer(init, token));

        if (response.status === 401) {
            const refreshed = await refreshTokens();
            if (!refreshed) {
                throw new ApiError("Требуется авторизация", 401);
            }
            const newToken = await this.ensureAccessToken();
            response = await fetch(input, this.withBearer(init, newToken));
            if (response.status === 401) {
                signOut();
            }
        }

        return response;
    }

    private withBearer(init: RequestInit, token: string): RequestInit {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return { ...init, headers };
    }
}

export default BaseService;
