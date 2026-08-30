import { makeAutoObservable, runInAction } from "mobx";
import { MultiPolygonGeometry } from "@yandex/ymaps3-types";
import { t } from "../i18n";
import MapService, { AdminBoundary, AdminBoundaryMarksCount, AdminBoundaryRef, GetAdminBoundariesMarksCountRequest, GetAdminBoundariesRequest } from "../services/MapService";
import notificationsStore from "./notifications";
import { unwrapList } from "../services/http";
import { mapWithLimit } from "../utils/concurrency";
import marksStore from "./marks";

/**
 * How many `.geojson` files are in flight at once. Six is what a browser opens to one origin
 * over HTTP/1.1 anyway; asking for more only queues them in the browser instead of here.
 */
const GEOMETRY_CONCURRENCY = 6;

class AdminBoundariesStore {
    /**
     * Boundaries whose geometry has arrived, in `admin_level` order. Same shape as before --
     * `Map.tsx` hands `boundary.geom` straight to `YMapFeature`, which has no meaning without
     * one, so a boundary only appears here once it can actually be drawn. The list is
     * committed once per level rather than once per file, so the map re-renders three times
     * during a load and not sixty.
     */
    boundaries: AdminBoundary[] = [];
    /**
     * id + name + level of every boundary, geometry or no geometry: what the district
     * `<select>` in analytics and the leaderboard reads. It is there long before the polygons.
     */
    index: AdminBoundaryRef[] = [];
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
    /**
     * Geometry already fetched, by boundary id. Plain, not observable: it is a cache of bytes,
     * and what the UI watches is `boundaries`. It survives a `force` reload, so switching the
     * language re-reads the (localized) names and not the (language-independent) polygons.
     */
    private readonly geomById = new Map<number, MultiPolygonGeometry>();

    constructor() {
        makeAutoObservable<AdminBoundariesStore, "loadedBoundaries" | "boundariesRequest" | "geomById">(this, {
            loadedBoundaries: false,
            boundariesRequest: false,
            geomById: false,
        });
    }

    /**
     * Loads the admin boundaries once. Concurrent callers share the one in-flight request and
     * later ones reuse what the map already loaded; `force` re-fetches (e.g. after a language
     * change), and a failed request is not remembered, so the next caller tries again.
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

    /**
     * Two steps rather than one request, because the one request was a megabyte.
     *
     * `GET /map/admin-boundaries` serializes every polygon: 61 boundaries, 1 080 153 bytes, of
     * which 99.2% is `geom`. That is past `ETAG_MAX_ENTRY_CHARS`, so the ETag cache refuses to
     * keep it and the whole megabyte is downloaded again on every single start -- for a screen
     * whose two other consumers (analytics, the leaderboard) only ever wanted `id` and `name`.
     *
     * So: a geometry-less index first (~9.6 KB, see `getAdminBoundaryIndex`), then one
     * `.geojson` per boundary. Those carry `Cache-Control: max-age=86400`, which puts them in
     * the browser's own HTTP cache -- the same bytes on a cold start, and none at all on a warm
     * one. They are fetched level by level, so the districts the map draws when zoomed out are
     * on screen before the neighbourhoods it only draws up close.
     *
     * If the `.geojson` route is not there (an older backend), nothing at all would be drawn --
     * hence the fallback to the old bulk request.
     */
    private loadBoundaries = async (): Promise<void> => {
        this.isLoadingBoundaries = true;
        this.errorBoundaries = null;
        try {
            const levels = this.filtersBoundaries.admin_levels;
            const index = await MapService.getAdminBoundaryIndex(levels);
            runInAction(() => {
                this.index = index;
            });

            const drawn: AdminBoundary[] = [];
            for (const level of levels) {
                const refs = index.filter((ref) => ref.admin_level === level);
                const missing = refs.filter((ref) => !this.geomById.has(ref.id));
                await mapWithLimit(missing, GEOMETRY_CONCURRENCY, async (ref) => {
                    const feature = (await MapService.getAdminBoundaryGeoJSON(ref.id)).payload;
                    if (feature) {
                        this.geomById.set(ref.id, feature.geometry);
                    }
                });
                for (const ref of refs) {
                    const geom = this.geomById.get(ref.id);
                    if (geom) {
                        drawn.push({ ...ref, geom });
                    }
                }
                runInAction(() => {
                    this.boundaries = [...drawn];
                });
            }

            if (drawn.length === 0 && index.length > 0) {
                await this.loadBoundariesInBulk();
            }
            runInAction(() => {
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

    /** The pre-`.geojson` path: everything, geometry included, in one heavy response. */
    private loadBoundariesInBulk = async (): Promise<void> => {
        const response = await MapService.getAdminBoundaries(this.filtersBoundaries);
        const boundaries = unwrapList<AdminBoundary>(response.payload, "admin_boundaries");
        boundaries.forEach((boundary) => {
            if (boundary.geom) {
                this.geomById.set(boundary.id, boundary.geom);
            }
        });
        runInAction(() => {
            this.boundaries = boundaries;
            if (this.index.length === 0) {
                this.index = boundaries.map(({ id, name, admin_level }) => ({ id, name, admin_level }));
            }
        });
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

    /** Back to nothing loaded (sign-out, and the reset between tests). */
    reset = () => {
        this.boundaries = [];
        this.index = [];
        this.marksCount = [];
        this.isLoadingBoundaries = false;
        this.isLoadingMarksCount = false;
        this.errorBoundaries = null;
        this.errorMarkCount = null;
        this.loadedBoundaries = false;
        this.boundariesRequest = null;
        this.geomById.clear();
    }
}

const adminBoundariesStore = new AdminBoundariesStore();

export default adminBoundariesStore;
