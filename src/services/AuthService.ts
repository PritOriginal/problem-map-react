import BaseService, { IResponse } from "./BaseService"

export type SignUpRequest = {
    username: string
    login: string
    password: string
}

export type SignInRequest = {
    login: string
    password: string
}

export type SignInResponsePayload = {
    access_token: string
    refresh_token: string
}

export interface SignInResponse extends IResponse {
    payload: SignInResponsePayload;
}

export type RefreshTokensRequest = {
    refresh_token: string
}

export interface RefreshTokensResponse extends IResponse {
    payload: RefreshTokensResponsePayload;
}

export type RefreshTokensResponsePayload = {
    access_token: string
    refresh_token: string
}

class AuthService extends BaseService {
    public signUp(req: SignUpRequest): Promise<IResponse> {
        return fetch("/api/auth/signup", {
            method: "POST",
             headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        }).then(this.getResponse)
    }

    public signIn(req: SignInRequest): Promise<SignInResponse> {
        return fetch("/api/auth/signin", {
            method: "POST",
             headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        }).then(this.getResponse)
    }

    public refreshTokens(req: RefreshTokensRequest): Promise<RefreshTokensResponse> {
        return fetch("/api/auth/tokens/refresh", {
            method: "POST",
             headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        }).then(this.getResponse)
    }
}

export default new AuthService();