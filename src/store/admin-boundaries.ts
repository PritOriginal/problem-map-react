import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import MapService, { AdminBoundary, AdminBoundaryMarksCount, GetAdminBoundariesMarksCountRequest, GetAdminBoundariesRequest } from "../services/MapService";
import notificationsStore from "./notifications";
import { unwrapList } from "../services/http";
import marksStore from "./marks";

class AdminBoundariesStore {
    boundaries: AdminBoundary[] = [];
    marksCount: AdminBoundaryMarksCount[] = [];

    filtersBoundaries: GetAdminBoundariesRequest = {
        admin_levels: [6, 9, 10]
    }
    filtersMarksCount: GetAdminBoundariesMarksCountRequest = {
        admin_levels: [6, 9, 10],
        mark_type_ids: [],
    }

    isLoadingBoundaries: boolean = false;
    isLoadingMarksCount: boolean = false;

    errorBoundaries: string | null = null;
    errorMarkCount: string | null = null;

    /** Bookkeeping for the load-once guard; not part of the observable state. */
    private loadedBoundaries: boolean = false;
    private boundariesRequest: Promise<void> | null = null;

    constructor() {
        makeAutoObservable<AdminBoundariesStore, "loadedBoundaries" | "boundariesRequest">(this, {
            loadedBoundaries: false,
            boundariesRequest: false,
        });
    }

    /**
     * Loads the admin boundaries once. The response carries the full polygon geometry — it is
     * the heaviest in the app (too big even for the ETag cache, see `ETAG_MAX_ENTRY_CHARS`), and
     * the analytics/leaderboard panels only need `id` + `name` for their district `<select>`.
     * So concurrent callers share the one in-flight request and later ones reuse what the map
     * already loaded. `force` re-fetches (e.g. after a language change); a failed request is not
     * remembered, so the next caller tries again.
     */
    fetchBoundaries = (force: boolean = false): Promise<void> => {
        if (this.boundariesRequest) {
            return this.boundariesRequest;
        }
        if (this.loadedBoundaries && !force) {
            return Promise.resolve();
        }
        this.boundariesRequest = this.loadBoundaries();
        return this.boundariesRequest;
    }

    private loadBoundaries = async (): Promise<void> => {
        this.isLoadingBoundaries = true;
        this.errorBoundaries = null;
        try {
            const response = await MapService.getAdminBoundaries(this.filtersBoundaries);
            runInAction(() => {
                this.boundaries = unwrapList<AdminBoundary>(response.payload, "admin_boundaries");
                this.loadedBoundaries = true;
                this.isLoadingBoundaries = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.errorBoundaries = notificationsStore.showError(error, t("errors.boundaries"));
                this.isLoadingBoundaries = false;
            });
        } finally {
            this.boundariesRequest = null;
        }
    }

    /**
     * Mark counts by boundary id — a computed index. The map draws every boundary in a
     * `.map()`, and a `find()` per boundary made that O(boundaries x counts) per render.
     */
    get countById(): Map<number, AdminBoundaryMarksCount> {
        return new Map(this.marksCount.map((count) => [count.id, count]));
    }

    fetchMarksCount = async () => {
        this.isLoadingMarksCount = true;
        this.errorMarkCount = null;
        try {
            const response = await MapService.getAdminBoundariesMarksCount({
                ...this.filtersMarksCount,
                mark_type_ids: marksStore.filters.mark_type_ids,
            });
            runInAction(() => {
                this.marksCount = unwrapList<AdminBoundaryMarksCount>(response.payload, "admin_boundaries");
                this.isLoadingMarksCount = false;
            });
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.errorMarkCount = notificationsStore.showError(error, t("errors.boundaryStats"));
                this.isLoadingMarksCount = false;
            });
        }
    }
}

const adminBoundariesStore = new AdminBoundariesStore();

export default adminBoundariesStore;