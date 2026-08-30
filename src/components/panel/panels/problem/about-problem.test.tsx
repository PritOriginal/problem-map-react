import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";

import AboutProblem from "./about-problem";
import { MarkContext } from "./mark-context";
import { renderPanel, resetStores } from "../../../../test/render";
import { mockFetchRoutes } from "../../../../test/fetch";
import { clearTokens, saveTokens } from "../../../../services/tokens";
import markStatusesStore from "../../../../store/mark-statuses";
import user from "../../../../store/user";
import { Mark, MarkStatusType } from "../../../../services/MarksService";

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
    description: "a pothole on the corner",
    user_id: 1,
    mark_status_id: MarkStatusType.ConfirmedStatus,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
};

const HISTORY = [
    {
        id: 1,
        mark_id: 7,
        old_mark_status_id: null,
        new_mark_status_id: MarkStatusType.UnconfirmedStatus,
        changed_at: "2026-01-01T00:00:00Z",
        checks: [],
    },
    {
        id: 2,
        mark_id: 7,
        old_mark_status_id: MarkStatusType.UnconfirmedStatus,
        new_mark_status_id: MarkStatusType.ConfirmedStatus,
        changed_at: "2026-01-02T00:00:00Z",
        // `checks` omitted on purpose: the field is optional in the contract, and the
        // column used to read it with a `!`.
    },
];

describe("AboutProblem", () => {
    beforeEach(() => {
        resetStores();
        runInAction(() => {
            markStatusesStore.statuses = [
                { mark_status_id: MarkStatusType.UnconfirmedStatus, name: "unconfirmed", parent_id: null },
                { mark_status_id: MarkStatusType.ConfirmedStatus, name: "confirmed", parent_id: null },
            ];
        });
        mockFetchRoutes({
            "GET /api/marks/7/status-history": { items: HISTORY },
            "GET /api/marks/7/comments": { comments: [] },
            // A signed-in user makes the tasks store fetch; unrelated here, but an
            // unmocked route would log a rejection through every test that signs in.
            "GET /api/tasks/user/5": { tasks: [] },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearTokens();
        resetStores();
    });

    it("draws the description and one column layer per status change", async () => {
        renderPanel(
            <MarkContext.Provider value={MARK}>
                <AboutProblem />
            </MarkContext.Provider>,
        );

        expect(await screen.findByText("Проблема отмечена")).toBeInTheDocument();
        expect(screen.getByText("Проблема подтверждена")).toBeInTheDocument();
        expect(screen.getByText(MARK.description)).toBeInTheDocument();
        await waitFor(() => expect(document.querySelectorAll(".core__layer")).toHaveLength(2));
    });

    it("offers the check button on an open mark", async () => {
        renderPanel(
            <MarkContext.Provider value={MARK}>
                <AboutProblem />
            </MarkContext.Provider>,
        );

        expect(await screen.findByText("Опровергнуть | Подтвердить")).toBeInTheDocument();
    });

    it("withholds the check button once the mark is closed", async () => {
        // Authorized: an anonymous visitor is offered the button whatever the status.
        // The token goes with it, or the stores watching the session sign the user
        // straight back out and the id under test is 0 again.
        saveTokens(fakeAccessToken(), "refresh");
        user.setUser("checker", 5);
        renderPanel(
            <MarkContext.Provider value={{ ...MARK, mark_status_id: MarkStatusType.ClosedStatus }}>
                <AboutProblem />
            </MarkContext.Provider>,
        );

        expect(await screen.findByText("Проблема отмечена")).toBeInTheDocument();
        expect(screen.queryByText("Опровергнуть | Подтвердить")).not.toBeInTheDocument();
    });
});
