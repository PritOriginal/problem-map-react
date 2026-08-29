import BaseService, { IResponse, withIdempotencyKey } from "./BaseService";
import { ListMeta } from "./http";

/** Comment on a mark (backend integration/wave-5). Replies are one level deep (`parent_id`). */
export interface Comment {
    comment_id: number;
    mark_id: number;
    user_id: number;
    username: string;
    body: string;
    parent_id: number | null;
    created_at: string;
    updated_at: string;
    /** Soft-deleted: the body is blanked by the backend, the thread keeps its place. */
    deleted: boolean;
    is_mine: boolean;
}

/** How long (ms) after creation the author may still edit a comment. */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60_000;

export interface GetCommentsResponse extends IResponse {
    payload: Comment[];
    meta?: ListMeta;
}

export interface AddCommentRequest {
    body: string;
    parent_id?: number;
}

export interface AddCommentResponse extends IResponse {
    payload: Comment | { comment_id: number };
}

class CommentsService extends BaseService {
    public getComments(markId: number, limit: number = 100, offset: number = 0): Promise<GetCommentsResponse> {
        return this.request<GetCommentsResponse>(`/api/marks/${markId}/comments?limit=${limit}&offset=${offset}`)
            .then((res) => ({ ...res, payload: Array.isArray(res.payload) ? res.payload : [] }));
    }

    public addComment(markId: number, req: AddCommentRequest, idempotencyKey?: string): Promise<AddCommentResponse> {
        return this.requestWithAuth<AddCommentResponse>(`/api/marks/${markId}/comments`, withIdempotencyKey({
            method: "POST",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify(req),
        }, idempotencyKey));
    }

    /** Author only, within `COMMENT_EDIT_WINDOW_MS` after creation. */
    public updateComment(id: number, body: string): Promise<IResponse> {
        return this.requestWithAuth(`/api/comments/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ body }),
        });
    }

    /** Author or moderator. */
    public deleteComment(id: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/comments/${id}`, { method: "DELETE" });
    }
}

export default new CommentsService();
