import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import PanelRoute from "./panel";
import { renderPanel, resetStores } from "../../test/render";
import { mockFetchRoutes } from "../../test/fetch";
import { ru } from "../../i18n/ru";

/**
 * The panels are loaded with React.lazy, so a route now resolves in two steps.
 * What these tests protect is the seam between them: the panel shell (close button,
 * error banner) belongs to the layout and must stay mounted while the panel chunk
 * is still in flight -- a Suspense boundary placed around <Routes> instead of around
 * <Outlet /> would blank the whole panel on every navigation and pass no test but
 * this one.
 */
describe("PanelRoute lazy panels", () => {
    beforeEach(() => {
        resetStores();
        mockFetchRoutes({
            "GET /api/leaderboard": { leaderboard: [] },
            "GET /api/map/admin-boundaries": { admin_boundaries: [] },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps the panel shell mounted while a lazy panel loads, then renders it", async () => {
        const { container } = renderPanel(<PanelRoute />, { route: "/leaderboard" });
        // The shell's own close button, found by class rather than by role: once the
        // panel resolves it brings a close button of its own and the name is ambiguous.
        const shellCloseButton = container.querySelector(".panel__close-button");

        // Synchronously, before the dynamic import resolves: shell yes, panel no.
        expect(shellCloseButton).toBeInTheDocument();
        expect(screen.queryByText(ru["leaderboard.title"])).not.toBeInTheDocument();

        expect(await screen.findByText(ru["leaderboard.title"])).toBeInTheDocument();
        // The same shell node, never unmounted and remounted in between.
        expect(container.querySelector(".panel__close-button")).toBe(shellCloseButton);
    });

    it("shows the shared loading fallback rather than an empty panel", () => {
        renderPanel(<PanelRoute />, { route: "/leaderboard" });

        expect(screen.getByText(ru["common.loading"])).toBeInTheDocument();
    });

    it("renders nothing at /, so no panel chunk is needed for the map", () => {
        const { container } = renderPanel(<PanelRoute />, { route: "/" });

        expect(container.querySelector(".panel")).toBeNull();
        expect(screen.queryByText(ru["common.loading"])).not.toBeInTheDocument();
    });
});
