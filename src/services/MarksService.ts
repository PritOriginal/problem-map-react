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
 * Converts ymaps3 `LngLat` (= [lng, lat]) into the point fields the backend expects.
 * ВНИМАНИЕ: намеренная «перестановка». Бэкенд (handler/marks AddMark) собирает точку как
 * geom.Coord{Latitude, Longitude}, т.е. кладёт поле latitude в X (долгота), а longitude — в Y (широта).
 * Чтобы в БД оказалась корректная точка (X=lng, Y=lat), поля отправляются крест-накрест.
 * Если бэкенд исправят на Coord{Longitude, Latitude} — поменять индексы местами только здесь.
 */
export function toApiPoint([lng, lat]: LngLat): Point {
    return { longitude: lat, latitude: lng };
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

    public addMark(req: AddMarkRequest, photos: File[]): Promise<AddMarkResponse> {
        const form = new FormData();
        form.append("longitude", req.point.longitude.toString());
        form.append("latitude", req.point.latitude.toString());
        form.append("mark_type_id", req.mark_type_id.toString());
        form.append("description", req.description);
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.requestWithAuth<AddMarkResponse>("/api/marks", {
            method: "POST",
            body: form
        })
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