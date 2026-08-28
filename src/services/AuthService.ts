import BaseService, { IResponse } from "./BaseService"

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

class AuthService extends BaseService {
    public signUp(req: SignUpRequest): Promise<SignUpResponse> {
        return this.request<SignUpResponse>("/api/auth/signup", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        })
    }

    public signIn(req: SignInRequest): Promise<SignInResponse> {
        return this.request<SignInResponse>("/api/auth/signin", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(req),
        })
    }
}

export default new AuthService();