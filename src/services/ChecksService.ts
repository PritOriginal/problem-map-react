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

export type GetCheckByIdResponsePayload = {
    check: Check
}

export interface GetChecksByMarkIdResponse extends IResponse {
    payload: GetChecksByMarkIdResponsePayload;
}

export type GetChecksByMarkIdResponsePayload = {
    checks: Check[]
}

export interface GetChecksByUserIdResponse extends IResponse {
    payload: GetChecksByUserIdResponsePayload;
}

export type GetChecksByUserIdResponsePayload = {
    checks: Check[]
}

export type AddCheckRequest = {
    mark_id: number;
    result: boolean;
    comment: string;
}


class СhecksService extends BaseService {
    public getCheckById(id: number): Promise<GetCheckByIdResponse> {
        return fetch(`/api/checks/${id}`).then(this.getResponse)
    }

    public getChecksByMarkId(markId: number): Promise<GetChecksByMarkIdResponse> {
        return fetch(`/api/checks/mark/${markId}`).then(this.getResponse)
    }

    public getChecksByUserId(userId: number): Promise<GetChecksByUserIdResponse> {
        return fetch(`/api/checks/user/${userId}`).then(this.getResponse)
    }

    public addCheck(req: AddCheckRequest, photos: File[]): Promise<IResponse> {
        const bearer = 'Bearer ' + localStorage.getItem('access_token');

        const form = new FormData();
        form.append("data", JSON.stringify(req))
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return fetch("/api/checks", {
            method: "POST",
            headers: {
                'Authorization': bearer,
            },
            body: form
        }).then(this.getResponse)
    }
}

export default new СhecksService();