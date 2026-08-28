import BaseService, { IResponse } from "./BaseService";
import { Role } from "../utils/role";

export interface PointJSON {
    type?: string;
    coordinates: number[];
}

/** Full profile of the authenticated user (`GET /users/me`). */
export interface CurrentUser {
    user_id: number;
    username: string;
    login: string;
    rating: number;
    role: Role;
    home_point?: PointJSON | null;
}

export interface GetMeResponse extends IResponse {
    payload: {
        user: CurrentUser;
    };
}

class UsersService extends BaseService {
    public getMe(): Promise<GetMeResponse> {
        return this.requestWithAuth<GetMeResponse>("/api/users/me");
    }
}

export default new UsersService();
