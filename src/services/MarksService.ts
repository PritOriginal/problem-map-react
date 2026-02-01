import { PointGeometry } from "@yandex/ymaps3-types";
export interface Mark {
    mark_id: number;
    name: string;
    geom: PointGeometry,
    mark_type_id: number;
    user_id: number;
    district_id: number;
    number_votes: number;
    number_checks: number;
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
}

export interface AddMarkRequest {
    point: Point
    mark_type_id: number
    description: string
}

export interface Point {
    longitude: number
    latitude: number
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

class MarksService extends BaseService {
    public getMarks() {
        return fetch("/api/marks").then(this.getResponse)
    }

    public getMarkById(id: number) {
        return fetch(`/api/marks/${id}`).then(this.getResponse)
    }

    public getMarksByUserId(userId: number) {
        return fetch(`/api/marks/user/${userId}`).then(this.getResponse)
    }

    public addMark() {
        return fetch("/api/marks").then(this.getResponse)
    }

    public getMarkTypes() {
        return fetch("/api/marks/types").then(this.getResponse)
    }

    public getMarkStatuses() {
        return fetch("/api/marks/statuses").then(this.getResponse)
    }

    public checkAccessToken(): boolean {
        const access_token = localStorage.getItem('access_token');
        if (access_token) {
            const payload = jwtDecode(access_token);
            const dateNow = new Date();
            if (payload.exp! < dateNow.getTime()) {
                return false
            }
        } else {
            return false
        }
        return true
    }
}

export default new MarksService();