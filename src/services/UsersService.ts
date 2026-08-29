import { PointGeometry } from "@yandex/ymaps3-types";
import BaseService, { IResponse } from "./BaseService";
import { ListMeta } from "./http";
import { Role } from "../utils/role";

/** Full profile of the authenticated user (`GET /users/me`). */
export interface CurrentUser {
    user_id: number;
    username: string;
    login: string;
    rating: number;
    role: Role;
    home_point?: PointGeometry | null;
}

export interface GetMeResponse extends IResponse {
    payload: {
        user: CurrentUser;
    };
}

/** Aggregated user statistics (`GET /users/{id}/stats`, `GET /users/me/stats`). */
export interface UserStats {
    rating: number;
    marks_total: number;
    marks_confirmed: number;
    marks_refuted: number;
    checks_total: number;
    checks_correct: number;
    tasks_completed: number;
}

export interface GetUserStatsResponse extends IResponse {
    payload: UserStats;
}

export interface LeaderboardEntry {
    user_id: number;
    username: string;
    rating: number;
}

export interface GetLeaderboardResponse extends IResponse {
    payload: LeaderboardEntry[];
    meta: ListMeta;
}

class UsersService extends BaseService {
    public getMe(): Promise<GetMeResponse> {
        return this.requestWithAuth<GetMeResponse>("/api/users/me");
    }

    public getMyStats(): Promise<GetUserStatsResponse> {
        return this.requestWithAuth<GetUserStatsResponse>("/api/users/me/stats");
    }

    public getUserStats(id: number): Promise<GetUserStatsResponse> {
        return this.request<GetUserStatsResponse>(`/api/users/${id}/stats`);
    }

    public getLeaderboard(limit: number = 50, offset: number = 0): Promise<GetLeaderboardResponse> {
        return this.request<GetLeaderboardResponse>(`/api/leaderboard?limit=${limit}&offset=${offset}`);
    }
}

export default new UsersService();
