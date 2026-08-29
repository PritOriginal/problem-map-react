import { COMMENT_EDIT_WINDOW_MS, Comment } from "../services/CommentsService";

export interface CommentThread {
    root: Comment;
    replies: Comment[];
}

/** Groups a flat list into top-level comments with their (one level of) replies, oldest first. */
export function threadComments(list: Comment[]): CommentThread[] {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.comment_id - b.comment_id);
    const byId = new Map<number, CommentThread>();
    const threads: CommentThread[] = [];
    for (const comment of sorted) {
        if (comment.parent_id === null || comment.parent_id === undefined || !byId.has(comment.parent_id)) {
            const thread = { root: comment, replies: [] as Comment[] };
            byId.set(comment.comment_id, thread);
            threads.push(thread);
        }
    }
    for (const comment of sorted) {
        if (comment.parent_id !== null && comment.parent_id !== undefined) {
            const thread = byId.get(comment.parent_id);
            if (thread && thread.root.comment_id !== comment.comment_id) {
                thread.replies.push(comment);
            }
        }
    }
    return threads;
}

/** Whether the author may still edit the comment (15 minutes after creation). */
export function canEditComment(comment: Comment, nowMs: number = Date.now()): boolean {
    if (!comment.is_mine || comment.deleted) {
        return false;
    }
    const created = Date.parse(comment.created_at);
    return Number.isFinite(created) && nowMs - created < COMMENT_EDIT_WINDOW_MS;
}
