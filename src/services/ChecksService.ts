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
        return this.request<GetCheckByIdResponse>(`/api/checks/${id}`)
    }

    public getChecksByMarkId(markId: number): Promise<GetChecksByMarkIdResponse> {
        return this.request<GetChecksByMarkIdResponse>(`/api/checks/mark/${markId}`)
    }

    public getChecksByUserId(userId: number): Promise<GetChecksByUserIdResponse> {
        return this.request<GetChecksByUserIdResponse>(`/api/checks/user/${userId}`)
    }

    public addCheck(req: AddCheckRequest, photos: File[]): Promise<AddCheckResponse> {
        const form = new FormData();
        form.append("mark_id", req.mark_id.toString())
        form.append("result", req.result ? "true" : "false")
        form.append("comment", req.comment)
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.requestWithAuth<AddCheckResponse>("/api/checks", {
            method: "POST",
            body: form
        })
    }
}

export default new ChecksService();