import type { ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { runInAction } from "mobx";

import marksStore, { DEFAULT_FILTERS } from "../store/marks";
import markTypesStore from "../store/mark-types";
import markStatusesStore from "../store/mark-statuses";
import taskStatusesStore from "../store/task-statuses";
import organizationsStore from "../store/organizations";
import tasksStore from "../store/tasks";
import adminBoundariesStore from "../store/admin-boundaries";
import heatmapStore from "../store/heatmap";
import inboxStore from "../store/inbox";
import notificationsStore from "../store/notifications";
import offlineQueueStore from "../store/offline-queue";
import panelStore from "../store/panel";
import selectedMark from "../store/selected_mark";
import selectedPoint from "../store/selected_point";
import user from "../store/user";

export interface RenderPanelOptions {
    /** Entry in the memory history, e.g. "/marks/7". Defaults to "/". */
    route?: string;
    /** Route pattern the element is mounted under, e.g. "/marks/:id". Defaults to "*". */
    path?: string;
}

/**
 * Renders a screen-level panel inside a memory router. Panels read their ids from
 * `useParams`, so `route` and `path` have to be given together for a parameterised
 * screen: `renderPanel(<Problem />, { route: "/marks/7", path: "/marks/:id" })`.
 */
export function renderPanel(ui: ReactNode, opts: RenderPanelOptions = {}): RenderResult {
    return render(
        <MemoryRouter initialEntries={[opts.route ?? "/"]}>
            <Routes>
                <Route path={opts.path ?? "*"} element={ui} />
            </Routes>
        </MemoryRouter>,
    );
}

/**
 * Every store in src/store/ is a module-level singleton shared by all tests in a file,
 * so state leaks between them unless it is put back by hand. The list below is the
 * whole of src/store/ -- keeping it in one place is what makes a forgotten store visible.
 *
 * Stores that already own a reset (`clear`/`reset`) are reset through it; the rest have
 * their fields written directly inside `runInAction`, rather than growing a public method
 * that exists only for tests.
 */
export function resetStores(): void {
    runInAction(() => {
        // marks
        marksStore.marks = [];
        marksStore.filters = {
            mark_type_ids: [...DEFAULT_FILTERS.mark_type_ids],
            mark_status_ids: [...DEFAULT_FILTERS.mark_status_ids],
        };
        marksStore.isLoading = false;
        marksStore.error = null;

        // mark-types
        markTypesStore.types = [];
        markTypesStore.isLoading = false;
        markTypesStore.error = null;

        // mark-statuses
        markStatusesStore.statuses = [];
        markStatusesStore.isLoading = false;
        markStatusesStore.error = null;

        // task-statuses
        taskStatusesStore.statuses = [];

        // organizations -- `loaded` is a non-observable private guard against re-fetching
        organizationsStore.items = [];
        organizationsStore.isLoading = false;
        (organizationsStore as unknown as { loaded: boolean }).loaded = false;

        // tasks
        tasksStore.clear();
        tasksStore.isLoading = false;

        // admin-boundaries
        adminBoundariesStore.boundaries = [];
        adminBoundariesStore.marksCount = [];
        adminBoundariesStore.filtersBoundaries = { admin_levels: [6, 9, 10] };
        adminBoundariesStore.filtersMarksCount = { admin_levels: [6, 9, 10], mark_type_ids: [] };
        adminBoundariesStore.isLoadingBoundaries = false;
        adminBoundariesStore.isLoadingMarksCount = false;
        adminBoundariesStore.errorBoundaries = null;
        adminBoundariesStore.errorMarkCount = null;

        // heatmap -- setEnabled(false) also drops features (and so maxCount) and the request guard
        heatmapStore.setEnabled(false);

        // inbox -- stopPolling clears the interval and calls reset()
        inboxStore.stopPolling();

        // notifications
        notificationsStore.clear();

        // offline-queue (the IndexedDB storage itself is not touched)
        offlineQueueStore.stop();
        offlineQueueStore.items = [];
        offlineQueueStore.isFlushing = false;
        offlineQueueStore.loaded = false;
        offlineQueueStore.lastFlushedAt = 0;

        // panel
        panelStore.isOpen = false;
        panelStore.headerHeight = 0;

        // selected_mark -- clickedId is private and not observable-annotated
        selectedMark.id = 0;
        selectedMark.pendingCenter = null;
        (selectedMark as unknown as { clickedId: number }).clickedId = 0;

        // selected_point
        selectedPoint.coords = [1, 2];
        selectedPoint.visibility = false;
        selectedPoint.visibilityCircle = false;
        selectedPoint.color = "red";

        // user
        user.resetUser();
    });
}
