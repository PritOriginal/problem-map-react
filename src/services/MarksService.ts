import { LngLat } from "@yandex/ymaps3-types";
import BaseService, { IResponse, withIdempotencyKey } from "./BaseService"
import { PointGeometry } from "@yandex/ymaps3-types";
import { Check } from "./ChecksService";
import { isRecord, unwrapList } from "./http";
import { parseSimilarMarks } from "../utils/similar";


export interface Mark {
    mark_id: number;
    name: string;
    geom: PointGeometry,
    mark_type_id: number;
    description: string;
    user_id: number;
    mark_status_id: number;
    created_at: string;
    updated_at: string;
    /** Number of users following the mark (backend integration/wave-3). */
    followers_count?: number;
    /** Whether the current user follows the mark (only meaningful when authorized). */
    is_following?: boolean;
    /** Organization assigned to the mark (backend integration/wave-4); null when none. */
    organization_id?: number | null;
    /** SLA deadline for the assigned organization (ISO date-time); null when none. */
    sla_due_at?: string | null;
    /** True when `sla_due_at` has passed and the mark is still not resolved. */
    is_overdue?: boolean;
    /** Hidden by a moderator (backend integration/wave-5); still visible to moderators. */
    hidden?: boolean;
    /** Id of the original when the mark was merged as a duplicate (status 8); null otherwise. */
    merged_into_id?: number | null;
    /** Number of (non-deleted) comments. */
    comments_count?: number;
}

/** A mark near the point being reported, with the distance to it in meters. */
export type SimilarMark = Mark & { distance_m: number };

export interface GetSimilarMarksRequest {
    point: Point;
    mark_type_id: number;
    /** Search radius in meters (backend default when omitted). */
    radius?: number;
}

/** `GET /marks/similar` returns `{ marks: [...] }`; `payload` is unwrapped to the list. */
export interface GetSimilarMarksResponse extends IResponse {
    payload: SimilarMark[];
}

export interface UpdateMarkRequest {
    description?: string;
    mark_type_id?: number;
}

/** `POST/DELETE /marks/{id}/follow` return `{ mark_id, following }`. */
export interface FollowMarkResponse extends IResponse {
    payload?: {
        mark_id?: number;
        following?: boolean;
        followers_count?: number;
    };
}

export interface MarkType {
    mark_type_id: number;
    name: string;
    /** Language-independent code (backend integration/wave-4). */
    code?: string;
    /** Emoji / icon code for the marker (backend integration/wave-5); empty when the backend has none. */
    icon?: string;
    /** CSS color of the marker (`#rrggbb`); empty when the backend has none. */
    color?: string;
    sort_order?: number;
}

export interface MarkStatus {
    mark_status_id: number;
    name: string;
    parent_id: number | null;
    /** Language-independent code (backend integration/wave-4). */
    code?: string;
}

export enum MarkStatusType {
    UnconfirmedStatus = 1,
	ConfirmedStatus,
	UnderReviewStatus,
	RediscoveredStatus,
	ClosedStatus,
	RefutedStatus,
	/** Taken by an organization (backend integration/wave-4). */
	InWorkStatus,
	/** Merged into another mark (backend integration/wave-5). */
	DuplicateStatus,
}

/** Export formats of `GET /marks/export`. */
export type ExportFormat = "geojson" | "csv";

/**
 * Wave-4 dictionaries come as `{ id, code, name }` (localized `name`); older backends
 * return `{ mark_type_id, name }` in `payload.mark_types`. Accept both shapes.
 */
function dictList(payload: unknown, legacyKey: string): Record<string, unknown>[] {
    return unwrapList<unknown>(payload, legacyKey).filter(isRecord);
}

function dictId(item: Record<string, unknown>, legacyKey: string): number {
    const id = item.id ?? item[legacyKey];
    return typeof id === "number" ? id : Number(id);
}

export function normalizeMarkTypes(payload: unknown): MarkType[] {
    return dictList(payload, "mark_types")
        .map((item) => ({
            mark_type_id: dictId(item, "mark_type_id"),
            name: String(item.name ?? ""),
            code: typeof item.code === "string" ? item.code : undefined,
            icon: typeof item.icon === "string" && item.icon !== "" ? item.icon : undefined,
            color: typeof item.color === "string" && item.color !== "" ? item.color : undefined,
            sort_order: typeof item.sort_order === "number" ? item.sort_order : undefined,
        }))
        .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.mark_type_id - b.mark_type_id);
}

export function normalizeMarkStatuses(payload: unknown): MarkStatus[] {
    return dictList(payload, "mark_statuses").map((item) => ({
        mark_status_id: dictId(item, "mark_status_id"),
        name: String(item.name ?? ""),
        parent_id: typeof item.parent_id === "number" ? item.parent_id : null,
        code: typeof item.code === "string" ? item.code : undefined,
    }));
}

export interface AddMarkRequest {
    point: Point
    mark_type_id: number
    description: string
}

/**
 * Converts ymaps3 `LngLat` (= [lng, lat]) into the point fields the backend expects:
 * longitude = coords[0], latitude = coords[1] (natural order).
 * ВНИМАНИЕ: требует бэкенд с фиксом `fix/coords-lonlat` (handler/marks AddMark собирает
 * точку как Coord{Longitude, Latitude}). На старом бэкенде, который клал поле latitude в X,
 * метки будут перепутаны местами (lng/lat).
 */
export function toApiPoint([lng, lat]: LngLat): Point {
    return { longitude: lng, latitude: lat };
}

export interface AddMarkResponse extends IResponse {
    payload: AddMarkResponsePayload;
}

export interface AddMarkResponsePayload {
    mark_id: number;
}

export interface Point {
    longitude: number
    latitude: number
}

export interface GetMarksRequest {
    mark_type_ids: number[];
    mark_status_ids: number[];
}

export interface GetMarksResponse extends IResponse {
    payload: GetMarksResponsePayload;
}

export interface GetMarksResponsePayload {
    marks: Mark[]
}

export interface GetMarkByIdResponse extends IResponse {
    payload: GetMarkByIdResponsePayload;
}

export interface GetMarkByIdResponsePayload {
    mark: Mark
}

export interface GetMarksByUserIdResponse extends IResponse {
    payload: GetMarksByUserIdResponsePayload;
}

export interface GetMarksByUserIdResponsePayload {
    marks: Mark[]
}

export interface GetMarkTypesResponse extends IResponse {
    payload: MarkType[];
}

export interface GetMarkStatusesResponse extends IResponse {
    payload: MarkStatus[];
}

export interface ModerateMarkResponse extends IResponse {
    payload: {
        new_mark_staus_id: number;
    };
}

export interface MarkStatusHistoryItem {
    id: number;
    mark_id: number;
    old_mark_status_id: number | null;
    new_mark_status_id: number;
    changed_at: string;
    checks?: Check[]; 
}

/** `GET /marks/changes?since=` (backend integration/wave-5). */
export interface MarkChanges {
    marks: Mark[];
    deleted_ids: number[];
    hidden_ids: number[];
    /** Server clock at the time of the response; pass it as `since` next time. */
    server_time: string;
}

export interface GetMarkChangesResponse extends IResponse {
    payload: MarkChanges;
}

/** Normalizes a changes payload: missing lists become empty. */
export function normalizeMarkChanges(payload: unknown): MarkChanges {
    const p = isRecord(payload) ? payload : {};
    const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);
    return {
        marks: Array.isArray(p.marks) ? (p.marks as Mark[]) : [],
        deleted_ids: ids(p.deleted_ids),
        hidden_ids: ids(p.hidden_ids),
        server_time: typeof p.server_time === "string" ? p.server_time : new Date().toISOString(),
    };
}

export interface GetMarkStatusHistoryByMarkIdResponse extends IResponse {
    payload: GetMarkStatusHistoryByMarkIdResponsePayload
}

export interface GetMarkStatusHistoryByMarkIdResponsePayload {
    items: MarkStatusHistoryItem[];
}

/** Reads take an optional trailing `init` whose `signal` cancels a superseded request (`useAsyncData`). */
class MarksService extends BaseService {
    /**
     * `GET /marks?mark_type_ids=&mark_status_ids=` returns `{ marks: Mark[] }`.
     * `init.signal` lets the caller cancel a superseded request (see `src/store/marks.ts`).
     */
    public getMarks(req: GetMarksRequest, init?: Pick<RequestInit, "signal">): Promise<GetMarksResponse> {
        return this.request<GetMarksResponse>(`/api/marks?${this.filterParams(req)}`, init)
    }

    public getMarkById(id: number, init?: Pick<RequestInit, "signal">): Promise<GetMarkByIdResponse> {
        return this.request<GetMarkByIdResponse>(`/api/marks/${id}`, init)
    }

    public getMarksByUserId(userId: number, init?: Pick<RequestInit, "signal">): Promise<GetMarksByUserIdResponse> {
        return this.request<GetMarksByUserIdResponse>(`/api/marks/user/${userId}`, init)
    }

    /** Marks of the same type near the point. */
    public getSimilarMarks(req: GetSimilarMarksRequest, init?: Pick<RequestInit, "signal">): Promise<GetSimilarMarksResponse> {
        const params = new URLSearchParams({
            lon: String(req.point.longitude),
            lat: String(req.point.latitude),
            mark_type_id: String(req.mark_type_id),
        });
        if (req.radius !== undefined) {
            params.set("radius", String(req.radius));
        }
        return this.request<IResponse>(`/api/marks/similar?${params}`, init)
            .then((res) => ({ ...res, payload: parseSimilarMarks(res.payload) }));
    }

    /**
     * Creates a mark. Without `force` the backend may reject with 409 when similar marks
     * exist nearby (`ApiError.payload.similar_marks`); pass `force = true` to create anyway.
     */
    public addMark(req: AddMarkRequest, photos: Blob[], force: boolean = false, idempotencyKey?: string): Promise<AddMarkResponse> {
        const form = new FormData();
        form.append("longitude", req.point.longitude.toString());
        form.append("latitude", req.point.latitude.toString());
        form.append("mark_type_id", req.mark_type_id.toString());
        form.append("description", req.description);
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.requestWithAuth<AddMarkResponse>(`/api/marks${force ? "?force=true" : ""}`, withIdempotencyKey({
            method: "POST",
            body: form
        }, idempotencyKey))
    }

    /** Marks changed since `since` (ISO date-time), plus deleted / hidden ids (`GET /marks/changes`). */
    public getMarkChanges(since: string): Promise<GetMarkChangesResponse> {
        return this.request<IResponse>(`/api/marks/changes?since=${encodeURIComponent(since)}`)
            .then((res) => ({ ...res, payload: normalizeMarkChanges(res.payload) }));
    }

    /** Moderator/admin: hides or shows the mark (`PATCH /marks/{id}/hidden`). */
    public setMarkHidden(id: number, hidden: boolean): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}/hidden`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ hidden }),
        })
    }

    /** Moderator/admin: merges the mark into `targetId` as a duplicate; resolves with the target mark. */
    public mergeMark(id: number, targetId: number): Promise<GetMarkByIdResponse & { payload: Mark }> {
        return this.requestWithAuth<IResponse>(`/api/marks/${id}/merge-into/${targetId}`, { method: "POST" })
            .then((res) => {
                const payload = res.payload as Mark | { mark: Mark } | undefined;
                const mark = payload && "mark" in payload ? payload.mark : (payload as Mark);
                return { ...res, payload: mark } as GetMarkByIdResponse & { payload: Mark };
            })
    }

    /** Owner only (unconfirmed mark): updates description and/or type. */
    public updateMark(id: number, req: UpdateMarkRequest): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify(req),
        })
    }

    /** Owner only (unconfirmed mark): deletes the mark. */
    public deleteMark(id: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}`, { method: "DELETE" })
    }

    public followMark(id: number): Promise<FollowMarkResponse> {
        return this.requestWithAuth<FollowMarkResponse>(`/api/marks/${id}/follow`, { method: "POST" })
    }

    public unfollowMark(id: number): Promise<FollowMarkResponse> {
        return this.requestWithAuth<FollowMarkResponse>(`/api/marks/${id}/follow`, { method: "DELETE" })
    }

    /** Moderator/admin only: confirms the mark and moves it to a new status. */
    public confirmMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/confirm`, { method: "POST" })
    }

    /** Moderator/admin only: rejects the mark and moves it to a new status. */
    public rejectMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/reject`, { method: "POST" })
    }

    public getMarkTypes(): Promise<GetMarkTypesResponse> {
        return this.requestCached<IResponse>("/api/marks/types")
            .then((res) => ({ ...res, payload: normalizeMarkTypes(res.payload) }));
    }

    public getMarkStatuses(): Promise<GetMarkStatusesResponse> {
        return this.requestCached<IResponse>("/api/marks/statuses")
            .then((res) => ({ ...res, payload: normalizeMarkStatuses(res.payload) }));
    }

    /** Service (organization staff): Confirmed -> In work (`POST /marks/{id}/start`). */
    public startMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/start`, { method: "POST" })
    }

    /** Service: In work -> Under review with a report (`POST /marks/{id}/resolve`, multipart). */
    public resolveMark(id: number, comment: string, photos: File[]): Promise<ModerateMarkResponse> {
        const form = new FormData();
        form.append("comment", comment);
        photos.forEach((photo) => {
            form.append("photos", photo);
        });
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/resolve`, { method: "POST", body: form })
    }

    /** Moderator/admin: assigns the mark to an organization (`PATCH /marks/{id}/assign`). */
    public assignMark(id: number, organizationId: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}/assign`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ organization_id: organizationId }),
        })
    }

    /** URL of `GET /marks/export` for the given filters (opened by the browser as a download). */
    public exportUrl(req: GetMarksRequest, format: ExportFormat): string {
        const params = this.filterParams(req);
        params.set("format", format);
        return `/api/marks/export?${params}`;
    }

    private filterParams(req: GetMarksRequest): URLSearchParams {
        const params = new URLSearchParams();
        if (req.mark_type_ids.length > 0) {
            params.append("mark_type_ids", req.mark_type_ids.join(","));
        }
        if (req.mark_status_ids.length > 0) {
            params.append("mark_status_ids", req.mark_status_ids.join(","));
        }
        return params;
    }

    public getMarkStatusHistoryByMarkId(id: number, withChecks: boolean, init?: Pick<RequestInit, "signal">): Promise<GetMarkStatusHistoryByMarkIdResponse> {
        return this.request<GetMarkStatusHistoryByMarkIdResponse>(`/api/marks/${id}/status-history?withChecks=${withChecks}`, init)
    }
}

export default new MarksService();