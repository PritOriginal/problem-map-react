import { describe, expect, it } from "vitest";
import { canEditComment, threadComments } from "./comments";
import type { Comment } from "../services/CommentsService";

const c = (id: number, parent: number | null, created: string, extra: Partial<Comment> = {}): Comment => ({
    comment_id: id, mark_id: 1, user_id: 1, username: "u", body: "b", parent_id: parent, created_at: created, updated_at: created, deleted: false, is_mine: false, ...extra,
});

describe("threadComments", () => {
    it("groups replies under their root (one level) in chronological order", () => {
        const threads = threadComments([
            c(3, 1, "2026-01-01T00:03:00Z"),
            c(1, null, "2026-01-01T00:01:00Z"),
            c(2, null, "2026-01-01T00:02:00Z"),
            c(4, 99, "2026-01-01T00:04:00Z"), // orphan reply becomes a root
        ]);
        expect(threads.map((t) => t.root.comment_id)).toEqual([1, 2, 4]);
        expect(threads[0].replies.map((r) => r.comment_id)).toEqual([3]);
    });
});

describe("canEditComment", () => {
    const now = Date.parse("2026-01-01T00:20:00Z");
    it("allows the author within 15 minutes only", () => {
        expect(canEditComment(c(1, null, "2026-01-01T00:10:00Z", { is_mine: true }), now)).toBe(true);
        expect(canEditComment(c(1, null, "2026-01-01T00:04:00Z", { is_mine: true }), now)).toBe(false);
        expect(canEditComment(c(1, null, "2026-01-01T00:10:00Z", { is_mine: false }), now)).toBe(false);
        expect(canEditComment(c(1, null, "2026-01-01T00:10:00Z", { is_mine: true, deleted: true }), now)).toBe(false);
    });
});
