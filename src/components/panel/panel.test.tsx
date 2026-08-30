import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import PanelRoute from "./panel";
import { renderPanel, resetStores } from "../../test/render";
import { jsonResponse, mockFetchRoutes } from "../../test/fetch";
import { ru } from "../../i18n/ru";
import user from "../../store/user";
import { emptyMark } from "./panels/problem/mark-context";

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
            "GET /api/map/admin-boundaries/marks/count": { admin_boundaries: [] },
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

    /**
     * The prefetch is a side effect with no visible output, so what is worth pinning
     * down is the part that breaks silently: Safari has no requestIdleCallback, and a
     * warm-up left scheduled after unmount would fire against a dead component.
     */
    describe("role prefetch scheduling", () => {
        it("falls back to setTimeout where requestIdleCallback is missing, and cancels it", () => {
            vi.stubGlobal("requestIdleCallback", undefined);
            const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
            const setTimeoutSpy = vi.spyOn(window, "setTimeout");

            const { unmount } = renderPanel(<PanelRoute />, { route: "/leaderboard" });
            expect(setTimeoutSpy).toHaveBeenCalled();
            const handle = setTimeoutSpy.mock.results[0].value;

            unmount();
            expect(clearTimeoutSpy).toHaveBeenCalledWith(handle);
        });

        it("cancels the idle callback it booked when the panel unmounts", () => {
            const requestIdleCallback = vi.fn(() => 42);
            const cancelIdleCallback = vi.fn();
            vi.stubGlobal("requestIdleCallback", requestIdleCallback);
            vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

            const { unmount } = renderPanel(<PanelRoute />, { route: "/leaderboard" });
            expect(requestIdleCallback).toHaveBeenCalledTimes(1);

            unmount();
            expect(cancelIdleCallback).toHaveBeenCalledWith(42);
        });
    });

    /**
     * The route walk. Splitting a router is the kind of change that breaks one route
     * in sixteen -- a wrong import path in the `load` map, a panel with no default
     * export, a nested route whose child never resolves -- and none of it shows up
     * anywhere but on that one URL. Every route the panel serves is opened here and
     * required to get past its Suspense boundary.
     */
    describe("every route resolves its panel", () => {
        const routes = [
            "/problem/1",
            "/problem/1/add-check",
            "/add",
            "/signin",
            "/signup",
            "/profile",
            "/notifications",
            "/leaderboard",
            "/analytics",
            "/tasks",
            "/org",
            "/moderation",
            "/admin",
            "/users/1",
            "/queue",
        ];

        beforeEach(() => {
            // A catch-all rather than a route table: what is under test is that the
            // panel mounts, and every panel already handles a rejected or empty load
            // by rendering its error or empty state. An exact table here would only
            // couple this test to sixteen unrelated endpoint shapes.
            // `mark` is the one key a panel dereferences rather than guards --
            // problem.tsx reads `payload.mark` straight through -- so the blank
            // envelope carries the empty mark the panel itself starts from.
            vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, payload: { mark: emptyMark } })));
            // An admin sees the real screens; anonymous ones would render the
            // unauthorized block, which resolves too but exercises far less.
            user.setUser("admin", 1, "admin");
        });

        it.each(routes)("%s", async (route) => {
            const { container } = renderPanel(<PanelRoute />, { route });

            // The fallback the shell shows is the only .empty-state that is a direct
            // child of .panel; the panels' own loading lines sit deeper in the tree.
            await waitFor(() => {
                expect(container.querySelector(".panel > .empty-state")).toBeNull();
            });
            expect(container.querySelector(".panel__close-button")).toBeInTheDocument();
            // Something of the panel itself is on screen, not just the bare shell.
            expect(container.querySelector(".panel__header, .panel__content")).toBeInTheDocument();
        });

        it("/problem/:id resolves its nested child inside the panel it belongs to", async () => {
            const { container } = renderPanel(<PanelRoute />, { route: "/problem/1/add-check" });

            await waitFor(() => {
                expect(container.querySelector(".panel__content > .empty-state")).toBeNull();
            });
            // The problem panel's own header survived the child's load: the nested
            // boundary is inside .panel__content, not above the header.
            expect(container.querySelector(".panel__header")).toBeInTheDocument();
        });
    });

    it("renders nothing at /, so no panel chunk is needed for the map", () => {
        const { container } = renderPanel(<PanelRoute />, { route: "/" });

        expect(container.querySelector(".panel")).toBeNull();
        expect(screen.queryByText(ru["common.loading"])).not.toBeInTheDocument();
    });
});
