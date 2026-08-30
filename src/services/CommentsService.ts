import BaseService, { IResponse, unwrapList, unwrapOne, withIdempotencyKey } from "./BaseService";
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

/** Maximum comment length accepted by the backend. */
export const COMMENT_MAX_LENGTH = 2000;

/** `GET /marks/{id}/comments` returns `{ comments: Comment[] }`; `payload` is unwrapped to the list. */
export interface GetCommentsResponse extends IResponse {
    payload: Comment[];
    meta?: ListMeta;
}

export interface AddCommentRequest {
    body: string;
    parent_id?: number;
}

/** `POST /marks/{id}/comments` returns `{ comment: Comment }`; `payload` is unwrapped to the comment. */
export interface AddCommentResponse extends IResponse {
    payload: Comment | null;
}

/** Reads take an optional trailing `init` whose `signal` cancels a superseded request (`useAsyncData`). */
class CommentsService extends BaseService {
    public getComments(markId: number, limit: number = 100, offset: number = 0, init?: Pick<RequestInit, "signal">): Promise<GetCommentsResponse> {
        return this.request<GetCommentsResponse>(`/api/marks/${markId}/comments?limit=${limit}&offset=${offset}`, init)
            .then((res) => ({ ...res, payload: unwrapList<Comment>(res.payload, "comments") }));
    }

    public addComment(markId: number, req: AddCommentRequest, idempotencyKey?: string): Promise<AddCommentResponse> {
        return this.requestWithAuth<IResponse>(`/api/marks/${markId}/comments`, withIdempotencyKey({
            method: "POST",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify(req),
        }, idempotencyKey)).then((res) => ({ ...res, payload: unwrapOne<Comment>(res.payload, "comment") }));
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
