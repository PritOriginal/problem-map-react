import BaseService, { IResponse } from "./BaseService"

export interface Check {
    check_id: number;
    user_id: number;
    username: string
    mark_id: number;
    result: boolean;
    comment: string;
    photos: string[];
    created_at: string;
    updated_at: string;
}

export interface GetCheckByIdResponse extends IResponse {
    payload: GetCheckByIdResponsePayload;
}

export interface GetCheckByIdResponsePayload {
    check: Check
}

export interface GetChecksByMarkIdResponse extends IResponse {
    payload: GetChecksByMarkIdResponsePayload;
}

export interface GetChecksByMarkIdResponsePayload {
    checks: Check[]
}

export interface GetChecksByUserIdResponse extends IResponse {
    payload: GetChecksByUserIdResponsePayload;
}

export interface GetChecksByUserIdResponsePayload {
    checks: Check[]
}

export interface AddCheckRequest {
    mark_id: number;
    result: boolean;
    comment: string;
}

export interface AddCheckResponse extends IResponse {
    payload: AddCheckResponsePayload;
}

export interface AddCheckResponsePayload {
    check_id: number;
}


class ChecksService extends BaseService {
    public getCheckById(id: number): Promise<GetCheckByIdResponse> {
        return fetch(`/api/checks/${id}`).then((response) => this.getResponse<GetCheckByIdResponse>(response))
    }

    public getChecksByMarkId(markId: number): Promise<GetChecksByMarkIdResponse> {
        return fetch(`/api/checks/mark/${markId}`).then((response) => this.getResponse<GetChecksByMarkIdResponse>(response))
    }

    public getChecksByUserId(userId: number): Promise<GetChecksByUserIdResponse> {
        return fetch(`/api/checks/user/${userId}`).then((response) => this.getResponse<GetChecksByUserIdResponse>(response))
    }

    public addCheck(req: AddCheckRequest, photos: File[]): Promise<AddCheckResponse> {
        const form = new FormData();
        form.append("mark_id", req.mark_id.toString())
        form.append("result", req.result ? "true" : "false")
        form.append("comment", req.comment)
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.fetchWithAuth("/api/checks", {
            method: "POST",
            body: form
        }).then((response) => this.getResponse<AddCheckResponse>(response))
    }
}

export default new ChecksService();