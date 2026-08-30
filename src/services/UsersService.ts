import { PointGeometry } from "@yandex/ymaps3-types";
import BaseService, { IResponse, unwrapList, unwrapOne } from "./BaseService";
import { isRecord } from "./http";
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

/** `GET /users/{id}/stats` returns `{ stats: {...} }`; `payload` is unwrapped to the stats (null when absent). */
export interface GetUserStatsResponse extends IResponse {
    payload: UserStats | null;
}

export interface LeaderboardEntry {
    user_id: number;
    username: string;
    rating: number;
    /** Level number (backend integration/wave-5). */
    level?: number;
    badges_count?: number;
}

/**
 * `GET /leaderboard` returns `{ leaderboard: [...] }` with `level` as a `models.Level` object;
 * `payload` is unwrapped to the list and `level` reduced to its number.
 */
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

/** `GET /badges` returns `{ badges: [...] }`; `payload` is unwrapped to the list. */
export interface GetBadgesResponse extends IResponse {
    payload: BadgeInfo[];
}

/** Accepts `level` as a number or as `{ number, name, next_threshold }`. */
export function normalizeLeaderboard(payload: unknown): LeaderboardEntry[] {
    return unwrapList<unknown>(payload, "leaderboard").filter(isRecord).map((raw) => {
        const level = isRecord(raw.level) ? raw.level.number : raw.level;
        return {
            ...raw,
            user_id: Number(raw.user_id),
            username: String(raw.username ?? ""),
            rating: typeof raw.rating === "number" ? raw.rating : Number(raw.rating ?? 0),
            level: typeof level === "number" ? level : undefined,
            badges_count: typeof raw.badges_count === "number" ? raw.badges_count : undefined,
        };
    });
}

/** Reads take an optional trailing `init` whose `signal` cancels a superseded request (`useAsyncData`). */
class UsersService extends BaseService {
    public getMe(init?: Pick<RequestInit, "signal">): Promise<GetMeResponse> {
        return this.requestWithAuth<GetMeResponse>("/api/users/me", init);
    }

    public getMyStats(init?: Pick<RequestInit, "signal">): Promise<GetUserStatsResponse> {
        return this.requestWithAuth<IResponse>("/api/users/me/stats", init)
            .then((res) => ({ ...res, payload: unwrapOne<UserStats>(res.payload, "stats") }));
    }

    public getUserStats(id: number): Promise<GetUserStatsResponse> {
        return this.request<IResponse>(`/api/users/${id}/stats`)
            .then((res) => ({ ...res, payload: unwrapOne<UserStats>(res.payload, "stats") }));
    }

    public getLeaderboard(req: GetLeaderboardRequest = {}, init?: Pick<RequestInit, "signal">): Promise<GetLeaderboardResponse> {
        const params = new URLSearchParams();
        if (req.boundary_id) {
            params.set("boundary_id", String(req.boundary_id));
        }
        if (req.period && req.period !== "all") {
            params.set("period", req.period);
        }
        params.set("limit", String(req.limit ?? 50));
        params.set("offset", String(req.offset ?? 0));
        return this.request<IResponse>(`/api/leaderboard?${params}`, init)
            .then((res) => ({ ...res, payload: normalizeLeaderboard(res.payload) }));
    }

    public getProfile(id: number, init?: Pick<RequestInit, "signal">): Promise<GetProfileResponse> {
        return this.request<GetProfileResponse>(`/api/users/${id}/profile`, init)
            .then((res) => ({ ...res, payload: parseProfile(res.payload) }));
    }

    public getMyProfile(init?: Pick<RequestInit, "signal">): Promise<GetProfileResponse> {
        return this.requestWithAuth<GetProfileResponse>("/api/users/me/profile", init)
            .then((res) => ({ ...res, payload: parseProfile(res.payload) }));
    }

    /** Catalogue of all badges (`GET /badges`). */
    public getBadges(init?: Pick<RequestInit, "signal">): Promise<GetBadgesResponse> {
        return this.requestCached<IResponse>("/api/badges", init)
            .then((res) => ({ ...res, payload: unwrapList<BadgeInfo>(res.payload, "badges") }));
    }
}

export default new UsersService();
