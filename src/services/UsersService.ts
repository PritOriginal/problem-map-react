import { PointGeometry } from "@yandex/ymaps3-types";
import BaseService, { IResponse } from "./BaseService";
import { ListMeta } from "./http";
import { Role } from "../utils/role";
import { parseProfile } from "../utils/profile";

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
    /** Level number (backend integration/wave-5). */
    level?: number;
    badges_count?: number;
}

export interface GetLeaderboardResponse extends IResponse {
    payload: LeaderboardEntry[];
    meta?: ListMeta;
}

export type LeaderboardPeriod = "all" | "month" | "week";
export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = ["all", "month", "week"];

export interface GetLeaderboardRequest {
    boundary_id?: number;
    period?: LeaderboardPeriod;
    limit?: number;
    offset?: number;
}

/** Public profile (`GET /users/{id}/profile`, `GET /users/me/profile`; backend integration/wave-5). */
export interface UserLevel {
    number: number;
    name: string;
    /** Rating needed for the next level; null on the last level. */
    next_threshold: number | null;
}

export interface UserBadge {
    code: string;
    name: string;
    description: string;
    /** Emoji or icon code. */
    icon: string;
    earned_at: string;
}

/** Catalogue entry (`GET /badges`): a badge that can be earned. */
export type BadgeInfo = Omit<UserBadge, "earned_at">;

export interface UserProfile {
    user_id: number;
    username: string;
    rating: number;
    level: UserLevel;
    badges: UserBadge[];
    stats: Partial<UserStats>;
    member_since: string;
}

export interface GetProfileResponse extends IResponse {
    payload: UserProfile;
}

export interface GetBadgesResponse extends IResponse {
    payload: BadgeInfo[];
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

    public getLeaderboard(req: GetLeaderboardRequest = {}): Promise<GetLeaderboardResponse> {
        const params = new URLSearchParams();
        if (req.boundary_id) {
            params.set("boundary_id", String(req.boundary_id));
        }
        if (req.period && req.period !== "all") {
            params.set("period", req.period);
        }
        params.set("limit", String(req.limit ?? 50));
        params.set("offset", String(req.offset ?? 0));
        return this.request<GetLeaderboardResponse>(`/api/leaderboard?${params}`)
            .then((res) => ({ ...res, payload: Array.isArray(res.payload) ? res.payload : [] }));
    }

    public getProfile(id: number): Promise<GetProfileResponse> {
        return this.request<GetProfileResponse>(`/api/users/${id}/profile`)
            .then((res) => ({ ...res, payload: parseProfile(res.payload) }));
    }

    public getMyProfile(): Promise<GetProfileResponse> {
        return this.requestWithAuth<GetProfileResponse>("/api/users/me/profile")
            .then((res) => ({ ...res, payload: parseProfile(res.payload) }));
    }

    /** Catalogue of all badges (`GET /badges`). */
    public getBadges(): Promise<GetBadgesResponse> {
        return this.requestCached<GetBadgesResponse>("/api/badges")
            .then((res) => ({ ...res, payload: Array.isArray(res.payload) ? res.payload : [] }));
    }
}

export default new UsersService();
