import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./tokens";
import NotificationsService from "./NotificationsService";
import UsersService from "./UsersService";
import MarksService from "./MarksService";
import MapService from "./MapService";
import AnalyticsService from "./AnalyticsService";
import { ApiError } from "./http";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

function jsonResponse(body: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
    const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    return { url: String(input), init: init ?? {} };
}

describe("wave-3 services", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(ACCESS_TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, role: "user" }));
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("NotificationsService lists with limit/offset/unread and returns meta", async () => {
        const body = { success: true, payload: [{ id: 1, type: "mark", mark_id: 5, task_id: null, title: "t", body: "b", read_at: null, created_at: "2026-01-01" }], meta: { limit: 10, offset: 0, total: 1 } };
        fetchMock.mockResolvedValue(jsonResponse(body));
        const res = await NotificationsService.getNotifications({ limit: 10, offset: 0, unread: true });
        const { url, init } = lastCall(fetchMock);
        expect(url).toBe("/api/notifications?limit=10&offset=0&unread=true");
        expect(new Headers(init.headers).get("Authorization")).toMatch(/^Bearer /);
        expect(res.meta?.total).toBe(1);
        expect(res.payload[0].mark_id).toBe(5);
    });

    it("NotificationsService unread-count / read / read-all", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { count: 3 } }));
        expect((await NotificationsService.getUnreadCount()).payload.count).toBe(3);
        expect(lastCall(fetchMock).url).toBe("/api/notifications/unread-count");

        fetchMock.mockResolvedValue(jsonResponse({ success: true }));
        await NotificationsService.markRead(7);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/notifications/7/read", init: { method: "PATCH" } });
        await NotificationsService.markAllRead();
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/notifications/read-all", init: { method: "PATCH" } });
    });

    it("UsersService stats and leaderboard", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { rating: 10, marks_total: 1, marks_confirmed: 1, marks_refuted: 0, checks_total: 2, checks_correct: 2, tasks_completed: 0 } }));
        expect((await UsersService.getMyStats()).payload?.rating).toBe(10);
        expect(lastCall(fetchMock).url).toBe("/api/users/me/stats");
        await UsersService.getUserStats(4);
        expect(lastCall(fetchMock).url).toBe("/api/users/4/stats");

        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: [{ user_id: 1, username: "a", rating: 5 }], meta: { limit: 50, offset: 0, total: 1 } }));
        const lb = await UsersService.getLeaderboard();
        expect(lastCall(fetchMock).url).toBe("/api/leaderboard?limit=50&offset=0");
        expect(lb.payload[0].username).toBe("a");
    });

    it("MarksService similar / force / patch / delete / follow", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: [] }));
        await MarksService.getSimilarMarks({ point: { longitude: 41.4, latitude: 52.7 }, mark_type_id: 2, radius: 100 });
        expect(lastCall(fetchMock).url).toBe("/api/marks/similar?lon=41.4&lat=52.7&mark_type_id=2&radius=100");

        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { mark_id: 9 } }));
        const req = { point: { longitude: 41.4, latitude: 52.7 }, mark_type_id: 2, description: "d" };
        await MarksService.addMark(req, [], false);
        expect(lastCall(fetchMock).url).toBe("/api/marks");
        await MarksService.addMark(req, [], true);
        expect(lastCall(fetchMock).url).toBe("/api/marks?force=true");

        fetchMock.mockResolvedValue(jsonResponse({ success: true }));
        await MarksService.updateMark(9, { description: "x" });
        const patch = lastCall(fetchMock);
        expect(patch.url).toBe("/api/marks/9");
        expect(patch.init.method).toBe("PATCH");
        expect(JSON.parse(String(patch.init.body))).toEqual({ description: "x" });

        await MarksService.deleteMark(9);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/9", init: { method: "DELETE" } });
        await MarksService.followMark(9);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/9/follow", init: { method: "POST" } });
        await MarksService.unfollowMark(9);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/9/follow", init: { method: "DELETE" } });
    });

    it("POST /marks 409 carries similar_marks in ApiError.payload", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: false, error: { message: "similar marks exist" }, payload: { similar_marks: [{ mark_id: 1 }] } }, 409));
        const error = await MarksService.addMark({ point: { longitude: 1, latitude: 2 }, mark_type_id: 1, description: "" }, []).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).payload).toEqual({ similar_marks: [{ mark_id: 1 }] });
    });

    it("MapService heatmap builds the bbox query", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { type: "FeatureCollection", features: [] } }));
        await MapService.getHeatmap({ bbox: [41.2, 52.6, 41.5, 52.8], cell_m: 500, mark_type_ids: [1, 2], mark_status_ids: [] });
        expect(lastCall(fetchMock).url).toBe("/api/map/heatmap?bbox=41.200000%2C52.600000%2C41.500000%2C52.800000&cell_m=500&mark_type_ids=1%2C2");
    });

    it("AnalyticsService kpi / timeseries", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { total: 1, by_status: {}, avg_confirm_hours: null, median_confirm_hours: null, avg_close_hours: null, refuted_share: null, open_older_than_30d: 0 } }));
        await AnalyticsService.getKpi({ boundary_id: 3, from: "2026-01-01", to: "2026-02-01" });
        expect(lastCall(fetchMock).url).toBe("/api/analytics/kpi?boundary_id=3&from=2026-01-01&to=2026-02-01");
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: [] }));
        await AnalyticsService.getTimeseries({}, "week");
        expect(lastCall(fetchMock).url).toBe("/api/analytics/timeseries?step=week");
    });
});
