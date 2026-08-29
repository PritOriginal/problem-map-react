import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runInAction } from "mobx";

import CommentsBlock from "./comments";
import { MarkContext } from "./mark-context";
import { renderPanel, resetStores } from "../../../../test/render";
import { mockFetchRoutes } from "../../../../test/fetch";
import { clearTokens, saveTokens } from "../../../../services/tokens";
import user from "../../../../store/user";
import { t } from "../../../../i18n";
import { Mark, MarkStatusType } from "../../../../services/MarksService";
import type { Comment } from "../../../../services/CommentsService";

/** An unsigned JWT whose `exp` is far enough away for `ensureAccessToken` to accept it. */
function fakeAccessToken(): string {
    const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const MARK: Mark = {
    mark_id: 7,
    name: "",
    geom: { type: "Point", coordinates: [1, 2] },
    mark_type_id: 1,
    description: "",
    user_id: 1,
    mark_status_id: MarkStatusType.ConfirmedStatus,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
};

const COMMENT: Comment = {
    comment_id: 3,
    mark_id: 7,
    user_id: 1,
    username: "author",
    body: "the hole is still there",
    parent_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted: false,
    is_mine: true,
};

function renderComments() {
    return renderPanel(
        <MarkContext.Provider value={MARK}>
            <CommentsBlock />
        </MarkContext.Provider>,
    );
}

describe("CommentsBlock deletion", () => {
    beforeEach(() => {
        resetStores();
        saveTokens(fakeAccessToken(), "refresh");
        runInAction(() => { user.id = 1; });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearTokens();
        localStorage.clear();
    });

    it("asks before deleting and sends nothing when the question is declined", async () => {
        const routes = vi.fn();
        mockFetchRoutes({
            "GET /api/marks/7/comments": [COMMENT],
            "DELETE /api/comments/3": (req: Request) => { routes(req.method); return {}; },
        });
        const person = userEvent.setup();
        renderComments();

        await waitFor(() => expect(screen.getByText(COMMENT.body)).toBeInTheDocument());
        await person.click(screen.getByRole("button", { name: t("common.delete") }));

        // The question is asked...
        expect(await screen.findByText(t("comments.deleteQuestion"))).toBeInTheDocument();
        // ...and answering "no" leaves the comment alone.
        await person.click(screen.getByRole("button", { name: t("confirm.cancel") }));
        await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
        expect(routes).not.toHaveBeenCalled();
        expect(screen.getByText(COMMENT.body)).toBeInTheDocument();
    });

    it("deletes the comment once the question is confirmed", async () => {
        const deleted = vi.fn();
        mockFetchRoutes({
            "GET /api/marks/7/comments": () => (deleted.mock.calls.length === 0 ? [COMMENT] : []),
            "DELETE /api/comments/3": () => { deleted(); return {}; },
        });
        const person = userEvent.setup();
        renderComments();

        await waitFor(() => expect(screen.getByText(COMMENT.body)).toBeInTheDocument());
        await person.click(screen.getByRole("button", { name: t("common.delete") }));
        await person.click(await screen.findByRole("button", { name: t("confirm.ok") }));

        await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
    });
});
