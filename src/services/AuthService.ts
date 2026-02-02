import user from "../store/user"
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

    public async refreshTokens() {
        const refresh_token = localStorage.getItem('refresh_token');
        if (refresh_token !== null) {
            const req: RefreshTokensRequest = {
                refresh_token: refresh_token
            };

            try {
                const response = await fetch("/api/auth/tokens/refresh", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8',
                    },
                    body: JSON.stringify(req),
                });

                const data: RefreshTokensResponse = await this.getResponse(response);
                localStorage.setItem('access_token', data.payload.access_token);
                localStorage.setItem('refresh_token', data.payload.refresh_token);
                return true;
            } catch (error) {
                console.log(error);
                user.resetUser();
            }
        }
        return false;
    }
}

export default new AuthService();