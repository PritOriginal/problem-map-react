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
}

export interface MarkStatus {
    mark_status_id: number;
    name: string;
    parent_id: number | null;
}

export enum MarkStatusType {
    UnconfirmedStatus = 1,
	ConfirmedStatus,
	UnderReviewStatus,
	RediscoveredStatus,
	ClosedStatus,
	RefutedStatus
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
    payload: GetMarkTypesResponsePayload;
}

export interface GetMarkTypesResponsePayload {
    mark_types: MarkType[]
}

export interface GetMarkStatusesResponse extends IResponse {
    payload: GetMarkStatusesResponsePayload;
}

export interface GetMarkStatusesResponsePayload {
    mark_statuses: MarkStatus[]
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
        const params = new URLSearchParams();
        if (req.mark_type_ids.length > 0) {
            params.append("mark_type_ids", req.mark_type_ids.join(","));
        }
        if (req.mark_status_ids.length > 0) {
            params.append("mark_status_ids", req.mark_status_ids.join(","));
        }

        return this.request<GetMarksResponse>(`/api/marks?${params}`)
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
        return this.request<GetMarkTypesResponse>("/api/marks/types")
    }

    public getMarkStatuses(): Promise<GetMarkStatusesResponse> {
        return this.request<GetMarkStatusesResponse>("/api/marks/statuses")
    }

    public getMarkStatusHistoryByMarkId(id: number, withChecks: boolean): Promise<GetMarkStatusHistoryByMarkIdResponse> {
        return this.request<GetMarkStatusHistoryByMarkIdResponse>(`/api/marks/${id}/status-history?withChecks=${withChecks}`)
    }
}

export default new MarksService();