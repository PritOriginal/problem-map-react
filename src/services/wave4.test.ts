import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./tokens";
import TasksService from "./TasksService";
import OrganizationsService from "./OrganizationsService";
import MarksService, { normalizeMarkStatuses, normalizeMarkTypes } from "./MarksService";
import { setLang } from "../i18n";

function makeJwt(payload: Record<string, unknown>): string {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

function jsonResponse(body: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit; headers: Headers } {
    const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    return { url: String(input), init: init ?? {}, headers: new Headers(init?.headers) };
}

describe("wave-4 services", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        setLang("ru");
        localStorage.setItem(ACCESS_TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, role: "service" }));
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("sends Accept-Language on public and authenticated requests, following the current language", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [] }));
        await MarksService.getMarkTypes();
        expect(lastCall(fetchMock).headers.get("Accept-Language")).toBe("ru");
        expect(lastCall(fetchMock).headers.get("Authorization")).toBeNull();

        setLang("en");
        await MarksService.getMarkTypes();
        expect(lastCall(fetchMock).headers.get("Accept-Language")).toBe("en");

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { organization_id: 1, name: "x", description: "" } }));
        await OrganizationsService.getMe();
        const call = lastCall(fetchMock);
        expect(call.headers.get("Accept-Language")).toBe("en");
        expect(call.headers.get("Authorization")).toMatch(/^Bearer /);
    });

    it("TasksService builds the statuses/limit/offset query and reads task statuses", async () => {
        const task = { task_id: 1, name: "t", user_id: 3, mark_id: 9, status_id: 1, due_at: null, created_at: "", updated_at: "" };
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [task], meta: { limit: 20, offset: 0, total: 1 } }));
        const res = await TasksService.getUserTasks(3, { statuses: [1, 2, 3], limit: 20, offset: 0 });
        expect(lastCall(fetchMock).url).toBe("/api/tasks/user/3?statuses=1%2C2%2C3&limit=20&offset=0");
        expect(lastCall(fetchMock).headers.get("Authorization")).toMatch(/^Bearer /);
        expect(res.payload[0].mark_id).toBe(9);

        await TasksService.getUserTasks(3);
        expect(lastCall(fetchMock).url).toBe("/api/tasks/user/3");

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ id: 1, code: "assigned", name: "Выдано" }] }));
        expect((await TasksService.getTaskStatuses()).payload[0].code).toBe("assigned");
        expect(lastCall(fetchMock).url).toBe("/api/tasks/statuses");
    });

    it("OrganizationsService me / list / queue", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { organization_id: 5, name: "ЖКХ", description: "d" } }));
        expect((await OrganizationsService.getMe()).payload.organization_id).toBe(5);
        expect(lastCall(fetchMock).url).toBe("/api/organizations/me");

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [{ organization_id: 5, name: "ЖКХ" }] }));
        expect((await OrganizationsService.getOrganizations()).payload[0].name).toBe("ЖКХ");
        expect(lastCall(fetchMock).url).toBe("/api/organizations");
        expect(lastCall(fetchMock).headers.get("Authorization")).toBeNull();

        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: [], meta: { limit: 100, offset: 0, total: 0 } }));
        await OrganizationsService.getMarks(5, { status_ids: [2, 7], overdue: true, limit: 100, offset: 0 });
        expect(lastCall(fetchMock).url).toBe("/api/organizations/5/marks?status_ids=2%2C7&overdue=true&limit=100&offset=0");
        await OrganizationsService.getMarks(5, { overdue: false });
        expect(lastCall(fetchMock).url).toBe("/api/organizations/5/marks");
    });

    it("MarksService start / resolve / assign / export", async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ success: true, payload: { new_mark_staus_id: 7 } }));
        await MarksService.startMark(9);
        expect(lastCall(fetchMock)).toMatchObject({ url: "/api/marks/9/start", init: { method: "POST" } });

        const photo = new File(["x"], "p.jpg", { type: "image/jpeg" });
        await MarksService.resolveMark(9, "done", [photo]);
        const resolve = lastCall(fetchMock);
        expect(resolve.url).toBe("/api/marks/9/resolve");
        expect(resolve.init.method).toBe("POST");
        const form = resolve.init.body as FormData;
        expect(form.get("comment")).toBe("done");
        expect(form.getAll("photos")).toHaveLength(1);

        fetchMock.mockImplementation(async () => jsonResponse({ success: true }));
        await MarksService.assignMark(9, 5);
        const assign = lastCall(fetchMock);
        expect(assign.url).toBe("/api/marks/9/assign");
        expect(assign.init.method).toBe("PATCH");
        expect(JSON.parse(String(assign.init.body))).toEqual({ organization_id: 5 });

        expect(MarksService.exportUrl({ mark_type_ids: [1, 2], mark_status_ids: [2] }, "geojson"))
            .toBe("/api/marks/export?mark_type_ids=1%2C2&mark_status_ids=2&format=geojson");
        expect(MarksService.exportUrl({ mark_type_ids: [], mark_status_ids: [] }, "csv")).toBe("/api/marks/export?format=csv");
    });

    it("dictionaries accept both the wave-4 {id, code, name} shape and the legacy one", () => {
        expect(normalizeMarkTypes([{ id: 1, code: "trash", name: "Мусор" }])).toEqual([{ mark_type_id: 1, name: "Мусор", code: "trash" }]);
        expect(normalizeMarkTypes({ mark_types: [{ mark_type_id: 2, name: "Деревья" }] })).toEqual([{ mark_type_id: 2, name: "Деревья", code: undefined }]);
        expect(normalizeMarkStatuses([{ id: 7, code: "in_work", name: "В работе" }])).toEqual([{ mark_status_id: 7, name: "В работе", parent_id: null, code: "in_work" }]);
        expect(normalizeMarkStatuses({ mark_statuses: [{ mark_status_id: 4, name: "x", parent_id: 2 }] })[0].parent_id).toBe(2);
        expect(normalizeMarkTypes(null)).toEqual([]);
    });
});
