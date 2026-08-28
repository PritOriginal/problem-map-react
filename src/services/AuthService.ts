import BaseService, { IResponse } from "./BaseService"
import { refreshTokens } from "./tokens"

export interface SignUpRequest {
    username: string
    login: string
    password: string
}

export interface SignUpResponse extends IResponse {
    payload: SignUpResponsePayload;
}

export interface SignUpResponsePayload {
    user_id: number;
}

export interface SignInRequest {
    login: string
    password: string
}

export interface SignInResponsePayload {
    access_token: string
    refresh_token: string
}

export interface SignInResponse extends IResponse {
    payload: SignInResponsePayload;
}

export interface RefreshTokensRequest {
    refresh_token: string
}

export interface RefreshTokensResponse extends IResponse {
    payload: RefreshTokensResponsePayload;
}

export interface RefreshTokensResponsePayload {
    access_token: string
    refresh_token: string
}

class AuthService extends BaseService {
    public signUp(req: SignUpRequest): Promise<SignUpResponse> {
        return fetch("/api/auth/signup", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        }).then((response) => this.getResponse<SignUpResponse>(response))
    }

    public signIn(req: SignInRequest): Promise<SignInResponse> {
        return fetch("/api/auth/signin", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        }).then((response) => this.getResponse<SignInResponse>(response))
    }

    /** Refreshes the token pair. On failure tokens and the user store are cleared. */
    public refreshTokens(): Promise<boolean> {
        return refreshTokens();
    }
}

export default new AuthService();