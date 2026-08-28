import BaseService, { IResponse } from "./BaseService"
import { PointGeometry } from "@yandex/ymaps3-types";
import { Check } from "./ChecksService";
import { NullableInt } from "../utils/nullable";
import { getAccessToken, isAccessTokenValid } from "./tokens";


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
    /** guregu/null: number, null or `{ Int64, Valid }`; normalize with `nullableInt()`. */
    parent_id: NullableInt;
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

export interface MarkStatusHistoryItem {
    id: number;
    mark_id: number;
    /** guregu/null: number, null or `{ V, Valid }`; normalize with `nullableInt()`. */
    old_mark_status_id: NullableInt;
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

        return fetch(`/api/marks?${params}`).then((response) => this.getResponse<GetMarksResponse>(response))
    }

    public getMarkById(id: number): Promise<GetMarkByIdResponse> {
        return fetch(`/api/marks/${id}`).then((response) => this.getResponse<GetMarkByIdResponse>(response))
    }

    public getMarksByUserId(userId: number): Promise<GetMarksByUserIdResponse> {
        return fetch(`/api/marks/user/${userId}`).then((response) => this.getResponse<GetMarksByUserIdResponse>(response))
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

        return this.fetchWithAuth("/api/marks", {
            method: "POST",
            body: form
        }).then((response) => this.getResponse<AddMarkResponse>(response))
    }

    public getMarkTypes(): Promise<GetMarkTypesResponse> {
        return fetch("/api/marks/types").then((response) => this.getResponse<GetMarkTypesResponse>(response))
    }

    public getMarkStatuses(): Promise<GetMarkStatusesResponse> {
        return fetch("/api/marks/statuses").then((response) => this.getResponse<GetMarkStatusesResponse>(response))
    }

    public getMarkStatusHistoryByMarkId(id: number, withChecks: boolean): Promise<GetMarkStatusHistoryByMarkIdResponse> {
        return fetch(`/api/marks/${id}/status-history?withChecks=${withChecks}`).then((response) => this.getResponse<GetMarkStatusHistoryByMarkIdResponse>(response))
    }

    /** @deprecated use `ensureAccessToken()` / `isAccessTokenValid()` from `services/tokens`. */
    public checkAccessToken(): boolean {
        return isAccessTokenValid(getAccessToken());
    }
}

export default new MarksService();