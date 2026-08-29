import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./tokens";
import { unwrapList, unwrapOne } from "./http";
import { clearEtagCache } from "./BaseService";
import TasksService from "./TasksService";
import NotificationsService from "./NotificationsService";
import CommentsService from "./CommentsService";
import ReportsService from "./ReportsService";
import AnalyticsService from "./AnalyticsService";
import OrganizationsService, { normalizeOrganization } from "./OrganizationsService";
import UsersService, { normalizeLeaderboard } from "./UsersService";
import AdminService, { normalizeCreatedApiKey } from "./AdminService";
import MarksService from "./MarksService";
import ChecksService from "./ChecksService";
import MapService from "./MapService";
import { setLang } from "../i18n";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

function jsonResponse(body: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/** A fresh Response per call: a body can only be read once. */
function ok(payload: unknown, meta?: unknown): () => Promise<Response> {
    return async () => jsonResponse({ success: true, payload, meta });
}

describe("unwrapList / unwrapOne", () => {
    it("accepts the keyed object, a bare array and null", () => {
        expect(unwrapList<number>({ tasks: [1, 2] }, "tasks")).toEqual([1, 2]);
        expect(unwrapList<number>([3], "tasks")).toEqual([3]);
        expect(unwrapList(null, "tasks")).toEqual([]);
        expect(unwrapList(undefined, "tasks")).toEqual([]);
        expect(unwrapList({ tasks: null }, "tasks")).toEqual([]);
        expect(unwrapList({ other: [1] }, "tasks")).toEqual([]);
        expect(unwrapList("x", "tasks")).toEqual([]);
    });

    it("unwrapOne takes the keyed object or the bare one; null stays null", () => {
        expect(unwrapOne<{ a: number }>({ user: { a: 1 } }, "user")).toEqual({ a: 1 });
        expect(unwrapOne<{ a: number }>({ a: 1 }, "user")).toEqual({ a: 1 });
        expect(unwrapOne({ user: null }, "user")).toBeNull();
        expect(unwrapOne(null, "user")).toBeNull();
        expect(unwrapOne([1], "user")).toBeNull();
    });
});

// Payload shapes below are taken from the backend docs/swagger.yaml (internal/handler/<domain>/dto.go).
describe("service payloads match the backend contract", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        setLang("ru");
        localStorage.setItem(ACCESS_TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, role: "admin" }));
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("GET /tasks/user/{id} -> { tasks }, GET /tasks/statuses -> { task_statuses }", async () => {
        const task = { task_id: 1, name: "t", user_id: 3, mark_id: 9, status_id: 1, due_at: null, created_at: "", updated_at: "" };
        fetchMock.mockImplementation(ok({ tasks: [task] }, { limit: 20, offset: 0, total: 1 }));
        const res = await TasksService.getUserTasks(3);
        expect(res.payload).toEqual([task]);
        expect(res.meta?.total).toBe(1);
        expect(res.payload.map((x) => x.mark_id)).toEqual([9]);

        fetchMock.mockImplementation(ok({ tasks: null }));
        expect((await TasksService.getUserTasks(3)).payload).toEqual([]);

        fetchMock.mockImplementation(ok({ task_statuses: [{ id: 1, code: "assigned", name: "Выдано" }] }));
        expect((await TasksService.getTaskStatuses()).payload[0].code).toBe("assigned");
    });

    it("GET /notifications -> { notifications }", async () => {
        fetchMock.mockImplementation(ok({ notifications: [{ id: 1, type: "mark", mark_id: 5, task_id: null, title: "t", body: "b", read_at: null, created_at: "" }] }, { limit: 10, offset: 0, total: 1 }));
        const res = await NotificationsService.getNotifications();
        expect(res.payload[0].id).toBe(1);
        expect(res.meta?.total).toBe(1);
    });

    it("comments: GET -> { comments }, POST -> { comment }", async () => {
        const comment = { comment_id: 1, mark_id: 3, user_id: 1, username: "u", body: "x", parent_id: null, created_at: "", updated_at: "", deleted: false, is_mine: true };
        fetchMock.mockImplementation(ok({ comments: [comment] }));
        expect((await CommentsService.getComments(3)).payload).toEqual([comment]);
        fetchMock.mockImplementation(ok({ comment }));
        expect((await CommentsService.addComment(3, { body: "x" })).payload).toEqual(comment);
    });

    it("GET /moderation/queue -> { reports }", async () => {
        fetchMock.mockImplementation(ok({ reports: [{ report_id: 1, target_type: "mark", target_id: 5, reason: "spam", status: "open" }] }));
        expect((await ReportsService.getQueue()).payload[0].report_id).toBe(1);
    });

    it("GET /analytics/timeseries -> { timeseries }, /analytics/kpi flat", async () => {
        fetchMock.mockImplementation(ok({ timeseries: [{ period: "2026-01", created: 1, confirmed: 0, closed: 0, refuted: 0 }] }));
        expect((await AnalyticsService.getTimeseries({})).payload[0].created).toBe(1);
        fetchMock.mockImplementation(ok({ total: 4, by_status: { "1": 4 }, by_organization: [], avg_confirm_hours: null, median_confirm_hours: null, avg_close_hours: null, refuted_share: null, sla_breach_share: null }));
        expect((await AnalyticsService.getKpi({})).payload.total).toBe(4);
    });

    it("organizations: /me -> { organization: { id } }, list -> { organizations: [{ id, name }] }, marks -> { marks }", async () => {
        fetchMock.mockImplementation(ok({ organization: { id: 5, name: "ЖКХ", description: "d", created_at: "", members: [], responsibilities: [] } }));
        const me = await OrganizationsService.getMe();
        expect(me.payload).toMatchObject({ organization_id: 5, name: "ЖКХ", description: "d" });

        fetchMock.mockImplementation(ok({ organizations: [{ id: 5, name: "ЖКХ" }, { id: 6, name: "Дороги" }] }));
        const list = await OrganizationsService.getOrganizations();
        expect(list.payload.map((o) => o.organization_id)).toEqual([5, 6]);

        fetchMock.mockImplementation(ok({ marks: [{ mark_id: 1 }] }, { limit: 100, offset: 0, total: 1 }));
        expect((await OrganizationsService.getMarks(5)).payload[0].mark_id).toBe(1);

        expect(normalizeOrganization({ organization_id: 2, name: "x" })?.organization_id).toBe(2);
        expect(normalizeOrganization(null)).toBeNull();
        expect(normalizeOrganization({ name: "no id" })).toBeNull();
    });

    it("users: stats -> { stats }, leaderboard -> { leaderboard } with level object, badges -> { badges }, me -> { user }", async () => {
        const stats = { rating: 10, marks_total: 1, marks_confirmed: 1, marks_refuted: 0, checks_total: 2, checks_correct: 2, tasks_completed: 0 };
        fetchMock.mockImplementation(ok({ stats }));
        expect((await UsersService.getMyStats()).payload).toEqual(stats);
        expect((await UsersService.getUserStats(4)).payload).toEqual(stats);

        fetchMock.mockImplementation(ok({ leaderboard: [{ user_id: 4, username: "u", rating: 10, level: { number: 2, name: "n", next_threshold: 50 }, badges_count: 1 }] }, { limit: 50, offset: 0, total: 1 }));
        const lb = await UsersService.getLeaderboard();
        expect(lb.payload[0]).toMatchObject({ user_id: 4, level: 2, badges_count: 1 });
        expect(normalizeLeaderboard([{ user_id: 1, username: "a", rating: 5, level: 3 }])[0].level).toBe(3);
        expect(normalizeLeaderboard([{ user_id: 1, username: "a", rating: 5 }])[0].level).toBeUndefined();

        fetchMock.mockImplementation(ok({ badges: [{ code: "x", name: "X", description: "", icon: "⭐", metric: "marks_confirmed", threshold: 1 }] }));
        expect((await UsersService.getBadges()).payload[0].code).toBe("x");

        fetchMock.mockImplementation(ok({ profile: { user_id: 4, username: "u", rating: 10, level: { number: 1, name: "n", next_threshold: 50 }, badges: [], stats: {}, member_since: "" } }));
        expect((await UsersService.getProfile(4)).payload.user_id).toBe(4);

        fetchMock.mockImplementation(ok({ user: { user_id: 4, username: "u", login: "l", rating: 1, role: "user" } }));
        expect((await UsersService.getMe()).payload.user.user_id).toBe(4);
    });

    it("admin: api keys -> { api_keys: [{ api_key_id }] }, create -> { api_key, key }, mark types -> { mark_types }", async () => {
        fetchMock.mockImplementation(ok({ api_keys: [{ api_key_id: 7, name: "ci", prefix: "pm_live_0123", created_at: "2026-01-01T00:00:00Z", last_used_at: null, active: true }] }));
        const keys = await AdminService.getApiKeys();
        expect(keys.payload[0]).toMatchObject({ id: 7, name: "ci", prefix: "pm_live_0123" });

        fetchMock.mockImplementation(ok({ api_key: { api_key_id: 8, name: "ci", created_at: "" }, key: "pm_live_secret" }));
        expect((await AdminService.createApiKey("ci")).payload).toMatchObject({ id: 8, key: "pm_live_secret" });
        expect(normalizeCreatedApiKey({ id: 1, name: "x", key: "k", created_at: "" })).toMatchObject({ id: 1, key: "k" });
        expect(normalizeCreatedApiKey(null)).toBeNull();

        fetchMock.mockImplementation(ok({ mark_types: [{ id: 1, mark_type_id: 1, code: "trash", name: "Мусор", name_ru: "Мусор", name_en: "Trash", icon: "", color: "", sla_hours: 48, active: true, sort_order: 1 }] }));
        expect((await AdminService.getMarkTypes()).payload[0]).toMatchObject({ mark_type_id: 1, code: "trash", sla_hours: 48 });

        fetchMock.mockImplementation(ok({ id: 9, mark_type_id: 9, code: "c", name: "r", name_ru: "r", name_en: "e", sla_hours: 1, active: true, sort_order: 0 }));
        expect((await AdminService.addMarkType({ code: "c", name_ru: "r", name_en: "e", icon: "", color: "", sla_hours: 1 })).payload?.mark_type_id).toBe(9);
    });

    it("marks: list/user/by-id/history keep their keyed shape, similar -> { marks }, follow -> { mark_id, following }", async () => {
        const mark = { mark_id: 1, name: "", geom: { type: "Point", coordinates: [1, 2] }, mark_type_id: 1, description: "", user_id: 1, mark_status_id: 1, created_at: "", updated_at: "" };
        fetchMock.mockImplementation(ok({ marks: [mark] }));
        expect((await MarksService.getMarks({ mark_type_ids: [], mark_status_ids: [] })).payload.marks).toEqual([mark]);
        expect((await MarksService.getMarksByUserId(1)).payload.marks).toEqual([mark]);
        fetchMock.mockImplementation(ok({ mark }));
        expect((await MarksService.getMarkById(1)).payload.mark).toEqual(mark);
        fetchMock.mockImplementation(ok({ items: [{ id: 1, mark_id: 1, old_mark_status_id: null, new_mark_status_id: 2, changed_at: "" }] }));
        expect((await MarksService.getMarkStatusHistoryByMarkId(1, false)).payload.items).toHaveLength(1);

        fetchMock.mockImplementation(ok({ marks: [{ ...mark, distance_m: 12.5 }] }));
        const similar = await MarksService.getSimilarMarks({ point: { longitude: 1, latitude: 2 }, mark_type_id: 1 });
        expect(similar.payload[0].distance_m).toBe(12.5);

        fetchMock.mockImplementation(ok({ mark_id: 1, following: true }));
        expect((await MarksService.followMark(1)).payload?.following).toBe(true);

        fetchMock.mockImplementation(ok({ mark_types: [{ id: 1, mark_type_id: 1, code: "trash", name: "Мусор" }] }));
        expect((await MarksService.getMarkTypes()).payload[0]).toMatchObject({ mark_type_id: 1, code: "trash" });
        fetchMock.mockImplementation(ok({ mark_statuses: [{ id: 1, mark_status_id: 1, code: "unconfirmed", name: "x", parent_id: null }] }));
        expect((await MarksService.getMarkStatuses()).payload[0].mark_status_id).toBe(1);
    });

    it("checks and map keep their keyed shape", async () => {
        fetchMock.mockImplementation(ok({ checks: [{ check_id: 1 }] }));
        expect((await ChecksService.getChecksByMarkId(1)).payload.checks[0].check_id).toBe(1);
        expect((await ChecksService.getChecksByUserId(1)).payload.checks[0].check_id).toBe(1);
        fetchMock.mockImplementation(ok({ admin_boundaries: [{ id: 1, name: "a", admin_level: 4 }] }));
        expect((await MapService.getAdminBoundariesMarksCount({ admin_levels: [4], mark_type_ids: [] })).payload.admin_boundaries[0].id).toBe(1);
    });

    // The legacy-prefix purge itself runs once, on module load (see etagCache.test.ts):
    // a legacy entry appearing mid-session is simply never read, and the write is versioned.
    it("ETag cache: bodies stored by an older build (etag:* keys) are ignored, current keys are versioned", async () => {
        localStorage.setItem("etag:ru:/api/badges", JSON.stringify({ etag: '"old"', body: { success: true, payload: [] } }));
        fetchMock.mockResolvedValue(jsonResponse({ success: true, payload: { badges: [{ code: "x", name: "X", description: "", icon: "" }] } }, 200, { ETag: '"v1"' }));
        const res = await UsersService.getBadges();
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(new Headers(init.headers).get("If-None-Match")).toBeNull();
        expect(res.payload[0].code).toBe("x");
        expect(localStorage.getItem("etag:v2:ru:/api/badges")).not.toBeNull();

        clearEtagCache();
        expect(localStorage.getItem("etag:v2:ru:/api/badges")).toBeNull();
    });
});
