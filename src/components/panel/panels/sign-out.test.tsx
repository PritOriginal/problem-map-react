import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import Profile from "./sign-out";
import { renderPanel, resetStores } from "../../../test/render";
import { mockFetchRoutes } from "../../../test/fetch";
import { saveTokens } from "../../../services/tokens";
import { ru } from "../../../i18n/ru";
import user from "../../../store/user";
import markTypesStore from "../../../store/mark-types";

/** An unsigned JWT whose `exp` is far enough away for `ensureAccessToken` to accept it. */
function fakeAccessToken(): string {
    const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const MARK = {
    mark_id: 7,
    name: "",
    geom: { type: "Point", coordinates: [1, 2] },
    mark_type_id: 1,
    description: "",
    user_id: 1,
    mark_status_id: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
};

function stubBackend(over: Record<string, unknown> = {}): void {
    mockFetchRoutes({
        "GET /api/users/me": { user: { user_id: 1, username: "anna", login: "anna@mail", rating: 42, role: "user" } },
        "GET /api/users/me/stats": { stats: { rating: 42, marks_total: 3, marks_confirmed: 2, marks_refuted: 1, checks_total: 5, checks_correct: 4, tasks_completed: 6 } },
        "GET /api/users/me/profile": {
            profile: {
                user_id: 1,
                username: "anna",
                rating: 42,
                level: { number: 2, name: "Наблюдатель", next_threshold: 100 },
                badges: [{ code: "first", name: "Первая метка", earned_at: "2026-01-01T00:00:00Z" }],
                member_since: "2025-01-01T00:00:00Z",
            },
        },
        "GET /api/marks/user/1": { marks: [MARK] },
        "GET /api/checks/user/1": { checks: [] },
        "GET /api/badges": { badges: [] },
        "GET /api/organizations": { organizations: [] },
        ...over,
    });
}

describe("Profile (/profile)", () => {
    beforeEach(() => {
        resetStores();
        saveTokens(fakeAccessToken(), "refresh");
        user.setUser("anna", 1, "user");
        markTypesStore.types = [{ mark_type_id: 1, name: "Мусор", color: "#000", icon: "" } as never];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("renders the shared header rather than one of its own", async () => {
        stubBackend();

        const { container } = renderPanel(<Profile />);

        expect(await screen.findByRole("heading", { name: ru["profile.title"] })).toBeInTheDocument();
        // the shared header brings the sheet's collapse button with it
        expect(container.querySelector(".panel__header__handle")).toBeInTheDocument();
    });

    it("renders the shared profile body: level, badges and statistics", async () => {
        stubBackend();

        renderPanel(<Profile />);

        expect(await screen.findByText(ru["profile.stat.rating"])).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: ru["profile.level"] })).toBeInTheDocument();
        expect(screen.getByText("Первая метка")).toBeInTheDocument();
        expect(screen.getByText(ru["profile.stat.tasks"])).toBeInTheDocument();
        expect(screen.queryByText(ru["profile.statsUnavailable"])).not.toBeInTheDocument();
    });

    it("lists the user's marks as shared mark rows", async () => {
        stubBackend();

        const { container } = renderPanel(<Profile />);

        expect(await screen.findByText(ru["mark.n"].replace("{id}", "7"))).toBeInTheDocument();
        expect(container.querySelectorAll(".mark-row")).toHaveLength(1);
        expect(screen.queryByText(ru["profile.noMarks"])).not.toBeInTheDocument();
        // the checks list came back empty, and says so
        expect(screen.getByText(ru["profile.noChecks"])).toBeInTheDocument();
    });

    it("says the statistics are unavailable when the backend has no stats endpoint yet", async () => {
        stubBackend({ "GET /api/users/me/stats": { stats: null } });

        renderPanel(<Profile />);

        expect(await screen.findByText(ru["profile.statsUnavailable"])).toBeInTheDocument();
    });
});
