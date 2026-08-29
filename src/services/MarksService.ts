import { LngLat } from "@yandex/ymaps3-types";
import BaseService, { IResponse } from "./BaseService"
import { PointGeometry } from "@yandex/ymaps3-types";
import { Check } from "./ChecksService";


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
}

/** A mark near the point being reported, with the distance to it in meters. */
export type SimilarMark = Mark & { distance_m: number };

export interface GetSimilarMarksRequest {
    point: Point;
    mark_type_id: number;
    /** Search radius in meters (backend default when omitted). */
    radius?: number;
}

export interface GetSimilarMarksResponse extends IResponse {
    payload: SimilarMark[];
}

export interface UpdateMarkRequest {
    description?: string;
    mark_type_id?: number;
}

export interface FollowMarkResponse extends IResponse {
    payload?: {
        followers_count?: number;
    };
}

export interface MarkType {
    mark_type_id: number;
    name: string;
    /** Language-independent code (backend integration/wave-4). */
    code?: string;
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
}

/** Export formats of `GET /marks/export`. */
export type ExportFormat = "geojson" | "csv";

/**
 * Wave-4 dictionaries come as `{ id, code, name }` (localized `name`); older backends
 * return `{ mark_type_id, name }` in `payload.mark_types`. Accept both shapes.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function dictList(payload: unknown, legacyKey: string): Record<string, unknown>[] {
    const list = Array.isArray(payload) ? payload : isRecord(payload) ? payload[legacyKey] : [];
    return Array.isArray(list) ? list.filter(isRecord) : [];
}

function dictId(item: Record<string, unknown>, legacyKey: string): number {
    const id = item.id ?? item[legacyKey];
    return typeof id === "number" ? id : Number(id);
}

export function normalizeMarkTypes(payload: unknown): MarkType[] {
    return dictList(payload, "mark_types").map((item) => ({
        mark_type_id: dictId(item, "mark_type_id"),
        name: String(item.name ?? ""),
        code: typeof item.code === "string" ? item.code : undefined,
    }));
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

export interface GetMarkStatusHistoryByMarkIdResponse extends IResponse {
    payload: GetMarkStatusHistoryByMarkIdResponsePayload
}

export interface GetMarkStatusHistoryByMarkIdResponsePayload {
    items: MarkStatusHistoryItem[];
}

class MarksService extends BaseService {
    public getMarks(req: GetMarksRequest): Promise<GetMarksResponse> {
        return this.request<GetMarksResponse>(`/api/marks?${this.filterParams(req)}`)
    }

    public getMarkById(id: number): Promise<GetMarkByIdResponse> {
        return this.request<GetMarkByIdResponse>(`/api/marks/${id}`)
    }

    public getMarksByUserId(userId: number): Promise<GetMarksByUserIdResponse> {
        return this.request<GetMarksByUserIdResponse>(`/api/marks/user/${userId}`)
    }

    /** Marks of the same type near the point. */
    public getSimilarMarks(req: GetSimilarMarksRequest): Promise<GetSimilarMarksResponse> {
        const params = new URLSearchParams({
            lon: String(req.point.longitude),
            lat: String(req.point.latitude),
            mark_type_id: String(req.mark_type_id),
        });
        if (req.radius !== undefined) {
            params.set("radius", String(req.radius));
        }
        return this.request<GetSimilarMarksResponse>(`/api/marks/similar?${params}`);
    }

    /**
     * Creates a mark. Without `force` the backend may reject with 409 when similar marks
     * exist nearby (`ApiError.payload.similar_marks`); pass `force = true` to create anyway.
     */
    public addMark(req: AddMarkRequest, photos: File[], force: boolean = false): Promise<AddMarkResponse> {
        const form = new FormData();
        form.append("longitude", req.point.longitude.toString());
        form.append("latitude", req.point.latitude.toString());
        form.append("mark_type_id", req.mark_type_id.toString());
        form.append("description", req.description);
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.requestWithAuth<AddMarkResponse>(`/api/marks${force ? "?force=true" : ""}`, {
            method: "POST",
            body: form
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
        return this.request<IResponse>("/api/marks/types")
            .then((res) => ({ ...res, payload: normalizeMarkTypes(res.payload) }));
    }

    public getMarkStatuses(): Promise<GetMarkStatusesResponse> {
        return this.request<IResponse>("/api/marks/statuses")
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

    public getMarkStatusHistoryByMarkId(id: number, withChecks: boolean): Promise<GetMarkStatusHistoryByMarkIdResponse> {
        return this.request<GetMarkStatusHistoryByMarkIdResponse>(`/api/marks/${id}/status-history?withChecks=${withChecks}`)
    }
}

export default new MarksService();