import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./tokens";
import MarksService, { normalizeMarkChanges, normalizeMarkTypes } from "./MarksService";
import ChecksService from "./ChecksService";
import CommentsService from "./CommentsService";
import ReportsService from "./ReportsService";
import AdminService, { normalizeAdminMarkTypes } from "./AdminService";
import UsersService from "./UsersService";
import { setLang } from "../i18n";
import { ApiError } from "./http";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

function jsonResponse(body: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit; headers: Headers } {
    const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    return { url: String(input), init: init ?? {}, headers: new Headers(init?.headers) };
}

const KEY = "0f9c2c7e-3d2a-4c1b-9a8e-1234567890ab";

describe("wave-5 services", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        setLang("ru");
        localStorage.setItem(ACCESS_TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, role: "admin" }));
        fetchMock = vi.fn(async () => jsonResponse({ success: true, payload: { mark_id: 1, check_id: 1, comment_id: 1 } }));
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("passes Idempotency-Key on POST /marks, /checks and comments, and reuses it on a retry", async () => {
        const photo = new File(["x"], "p.jpg", { type: "image/jpeg" });
        await MarksService.addMark({ point: { longitude: 1, latitude: 2 }, mark_type_id: 1, description: "d" }, [photo], false, KEY);
        let call = lastCall(fetchMock);
        expect(call.url).toBe("/api/marks");
        expect(call.headers.get("Idempotency-Key")).toBe(KEY);
        expect(call.headers.get("Authorization")).toMatch(/^Bearer /);
        expect((call.init.body as FormData).getAll("photos")).toHaveLength(1);

        await ChecksService.addCheck({ mark_id: 3, result: true, comment: "" }, [photo], KEY);
        call = lastCall(fetchMock);
        expect(call.url).toBe("/api/checks");
        expect(call.headers.get("Idempotency-Key")).toBe(KEY);

        await CommentsService.addComment(3, { body: "hi", parent_id: 2 }, KEY);
        call = lastCall(fetchMock);
        expect(call.url).toBe("/api/marks/3/comments");
        expect(call.headers.get("Idempotency-Key")).toBe(KEY);
        expect(JSON.parse(String(call.init.body))).toEqual({ body: "hi", parent_id: 2 });

        // a retry with the same key sends exactly the same header
        fetchMock.mockImplementationOnce(async () => { throw new TypeError("Failed to fetch"); });
        await expect(CommentsService.addComment(3, { body: "hi" }, KEY)).rejects.toBeInstanceOf(TypeError);
        await CommentsService.addComment(3, { body: "hi" }, KEY);
        const keys = fetchMock.mock.calls.slice(-2).map(([, init]) => new Headers((init as RequestInit).headers).get("Idempotency-Key"));
        expect(keys).toEqual([KEY, KEY]);

        // without a key the header is absent
        await CommentsService.addComment(3, { body: "hi" });
        expect(lastCall(fetchMock).headers.get("Idempotency-Key")).toBeNull();
    });

    it("comments: list / update / delete", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ comment_id: 1, mark_id: 3, body: "x", parent_id: null, deleted: false, is_mine: true }] }));
        const res = await CommentsService.getComments(3, 20, 40);
        expect(lastCall(fetchMock).url).toBe("/api/marks/3/comments?limit=20&offset=40");
        expect(res.payload[0].comment_id).toBe(1);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true }));
        await CommentsService.updateComment(1, "new");
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/comments/1", init: { method: "PATCH" } });
        expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ body: "new" });
        await CommentsService.deleteComment(1);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/comments/1", init: { method: "DELETE" } });
    });

    it("GET /marks/changes is normalized and sends `since`", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { marks: [{ mark_id: 1 }], deleted_ids: [2], server_time: "2026-01-01T00:00:00Z" } }));
        const res = await MarksService.getMarkChanges("2025-12-31T00:00:00Z");
        expect(lastCall(fetchMock).url).toBe("/api/marks/changes?since=2025-12-31T00%3A00%3A00Z");
        expect(res.payload).toEqual({ marks: [{ mark_id: 1 }], deleted_ids: [2], hidden_ids: [], server_time: "2026-01-01T00:00:00Z" });
        expect(normalizeMarkChanges(null).marks).toEqual([]);
    });

    it("dictionaries send If-None-Match and resolve a 304 from the stored body", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ id: 1, code: "trash", name: "Мусор", icon: "🗑", color: "#123456", sort_order: 2 }] }, 200, { ETag: '"v1"' }));
        const first = await MarksService.getMarkTypes();
        expect(lastCall(fetchMock).headers.get("If-None-Match")).toBeNull();
        expect(first.payload[0]).toMatchObject({ mark_type_id: 1, icon: "🗑", color: "#123456", sort_order: 2 });

        fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
        const second = await MarksService.getMarkTypes();
        expect(lastCall(fetchMock).headers.get("If-None-Match")).toBe('"v1"');
        expect(second.payload).toEqual(first.payload);

        // a fresh 200 with a new ETag replaces the stored body
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ id: 2, code: "road", name: "Дорога" }] }, 200, { ETag: '"v2"' }));
        const third = await MarksService.getMarkTypes();
        expect(third.payload[0].mark_type_id).toBe(2);
        fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
        await MarksService.getMarkTypes();
        expect(lastCall(fetchMock).headers.get("If-None-Match")).toBe('"v2"');
    });

    it("mark types are sorted by sort_order", () => {
        const types = normalizeMarkTypes([{ id: 1, name: "a", sort_order: 5 }, { id: 2, name: "b", sort_order: 1 }, { id: 3, name: "c" }]);
        expect(types.map((x) => x.mark_type_id)).toEqual([2, 1, 3]);
    });

    it("reports and the moderation queue", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true }));
        await ReportsService.addReport({ target_type: "mark", target_id: 5, reason: "spam" });
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/reports", init: { method: "POST" } });
        expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ target_type: "mark", target_id: 5, reason: "spam" });

        fetchMock.mockImplementation(async () => jsonResponse({ success: false, error: { message: "already reported" } }, 409));
        const error = await ReportsService.addReport({ target_type: "check", target_id: 1, reason: "other", comment: "c" }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ report_id: 1, target_type: "mark", target_id: 5, reason: "spam", status: "open" }] }));
        const queue = await ReportsService.getQueue({ status: "open", target_type: "mark", limit: 100, offset: 0 });
        expect(lastCall(fetchMock).url).toBe("/api/moderation/queue?status=open&target_type=mark&limit=100&offset=0");
        expect(queue.payload[0].report_id).toBe(1);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true }));
        await ReportsService.setReportStatus(1, "dismissed");
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/moderation/reports/1", init: { method: "PATCH" } });
        await MarksService.setMarkHidden(5, true);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/5/hidden", init: { method: "PATCH" } });
        expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ hidden: true });

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { mark_id: 9, merged_into_id: null } }));
        const merged = await MarksService.mergeMark(5, 9);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/5/merge-into/9", init: { method: "POST" } });
        expect(merged.payload.mark_id).toBe(9);
    });

    it("profiles, badges and the filtered leaderboard", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { user_id: 4, username: "u", rating: 10, level: { number: 1, name: "n", next_threshold: 50 }, badges: [] } }));
        const profile = await UsersService.getProfile(4);
        expect(lastCall(fetchMock).url).toBe("/api/users/4/profile");
        expect(lastCall(fetchMock).headers.get("Authorization")).toBeNull();
        expect(profile.payload.level.next_threshold).toBe(50);
        await UsersService.getMyProfile();
        expect(lastCall(fetchMock).url).toBe("/api/users/me/profile");
        expect(lastCall(fetchMock).headers.get("Authorization")).toMatch(/^Bearer /);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ user_id: 4, username: "u", rating: 10, level: 1, badges_count: 2 }] }));
        await UsersService.getLeaderboard({ boundary_id: 3, period: "month", limit: 50, offset: 0 });
        expect(lastCall(fetchMock).url).toBe("/api/leaderboard?boundary_id=3&period=month&limit=50&offset=0");
        await UsersService.getLeaderboard({ period: "all" });
        expect(lastCall(fetchMock).url).toBe("/api/leaderboard?limit=50&offset=0");

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ code: "x", name: "X", description: "", icon: "⭐" }] }));
        expect((await UsersService.getBadges()).payload[0].code).toBe("x");
        expect(lastCall(fetchMock).url).toBe("/api/badges");
    });

    it("admin: settings, mark types, api keys", async () => {
        const settings = { vote_threshold: 3, dedup_radius_m: 50, max_checks_per_day: 5, rating: { check_correct: 1, check_wrong: -1, mark_confirmed: 2, mark_refuted: -2, task_completed: 3 }, tasker: { max_tasks_per_user: 3, target_probability: 0.5, max_radius_meters: 1000, task_ttl: "24h" } };
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: settings }));
        expect((await AdminService.getSettings()).payload.tasker.task_ttl).toBe("24h");
        expect(lastCall(fetchMock).url).toBe("/api/admin/settings");
        await AdminService.updateSettings(settings);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/admin/settings", init: { method: "PUT" } });
        expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual(settings);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ id: 1, code: "trash", name: "Мусор", name_ru: "Мусор", name_en: "Trash", icon: "🗑", color: "#111111", sla_hours: 48, active: false, sort_order: 1 }] }));
        const types = await AdminService.getMarkTypes();
        expect(lastCall(fetchMock).url).toBe("/api/admin/mark-types");
        expect(types.payload[0]).toMatchObject({ mark_type_id: 1, name_en: "Trash", sla_hours: 48, active: false });
        expect(normalizeAdminMarkTypes([{ mark_type_id: 2, name: "x" }])[0]).toMatchObject({ code: "", name_ru: "x", active: true, sla_hours: 0 });

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { mark_type_id: 9 } }));
        await AdminService.addMarkType({ code: "c", name_ru: "r", name_en: "e", icon: "i", color: "#000000", sla_hours: 1 });
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/admin/mark-types", init: { method: "POST" } });
        await AdminService.updateMarkType(9, { active: true, sort_order: 4 });
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/admin/mark-types/9", init: { method: "PATCH" } });
        expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ active: true, sort_order: 4 });

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { id: 1, name: "ci", key: "pm_secret", created_at: "" } }));
        expect((await AdminService.createApiKey("ci")).payload.key).toBe("pm_secret");
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/api-keys", init: { method: "POST" } });
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ id: 1, name: "ci", created_at: "" }] }));
        expect((await AdminService.getApiKeys()).payload).toHaveLength(1);
        fetchMock.mockImplementation(async () => jsonResponse({ success: true }));
        await AdminService.revokeApiKey(1);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/api-keys/1", init: { method: "DELETE" } });
    });
});
