import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminBoundariesStore from "./admin-boundaries";
import { jsonResponse } from "../test/fetch";

/**
 * The boundary list used to come down whole -- 62 polygons, 1 175 510 bytes, 99.2% of it
 * geometry, and past `ETAG_MAX_ENTRY_CHARS`, so the whole megabyte was re-downloaded on every
 * start. The store now reads a geometry-less index (`?geometry=false`, 9 624 bytes) and then
 * one cacheable `.geojson` per boundary; the map still sees `boundaries` with the same shape,
 * and the district `<select>` reads `index`, which is there long before the polygons are.
 */
describe("adminBoundariesStore.fetchBoundaries", () => {
    /** id + name + level, as `GET /map/admin-boundaries?geometry=false` answers. */
    const INDEX = [
        { id: 1, name: "Тамбовский округ", admin_level: 6 },
        { id: 2, name: "Советский район", admin_level: 9 },
        { id: 3, name: "Пехотка", admin_level: 10 },
    ];

    /** The same list as an older backend answers it: `geometry=false` ignored, polygons included. */
    const INDEX_WITH_GEOMETRY = INDEX.map((ref) => ({
        ...ref,
        geom: { type: "MultiPolygon", coordinates: [[[[41, 52], [41, 53], [42, 53], [41, 52]]]] },
    }));

    let fetchMock: ReturnType<typeof vi.fn>;
    let requested: string[];

    function geometryOf(id: number): unknown {
        return {
            type: "Feature",
            id,
            geometry: { type: "MultiPolygon", coordinates: [[[[41, 52], [41, 53], [42, 53], [41, 52]]]] },
            properties: { name: `boundary-${id}`, admin_level: 9 },
        };
    }

    /** Answers the index and each `.geojson` by id; anything else is a test bug. */
    function route(input: RequestInfo | URL): Response {
        const url = new URL(String(input), "http://localhost");
        requested.push(url.pathname + url.search);
        const geojson = /^\/api\/map\/admin-boundaries\/(\d+)\.geojson$/.exec(url.pathname);
        if (geojson) {
            return jsonResponse(geometryOf(Number(geojson[1])));
        }
        if (url.pathname === "/api/map/admin-boundaries/marks/count") {
            const level = Number(url.searchParams.get("admin_levels"));
            return jsonResponse({
                success: true,
                payload: { admin_boundaries: INDEX.filter((ref) => ref.admin_level === level) },
            });
        }
        if (url.pathname === "/api/map/admin-boundaries") {
            // the index when `geometry=false` is honoured; the bulk fallback otherwise
            const payload = url.searchParams.get("geometry") === "false"
                ? { admin_boundaries: INDEX }
                : { admin_boundaries: [{ id: 9, name: "bulk", admin_level: 6, geom: { type: "MultiPolygon", coordinates: [] } }] };
            return jsonResponse({ success: true, payload });
        }
        throw new Error(`unexpected request: ${url.pathname}`);
    }

    beforeEach(() => {
        adminBoundariesStore.reset();
        requested = [];
        fetchMock = vi.fn(async (input: RequestInfo | URL) => route(input));
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        adminBoundariesStore.reset();
    });

    it("reads the index in one geometry-less request, then one .geojson per boundary", async () => {
        await adminBoundariesStore.fetchBoundaries();

        // one request for the whole index, and not one per level as it used to be
        expect(requested.filter((url) => url.startsWith("/api/map/admin-boundaries?"))).toEqual([
            "/api/map/admin-boundaries?admin_levels=6%2C9%2C10&geometry=false",
        ]);
        expect(requested.filter((url) => url.startsWith("/api/map/admin-boundaries/marks/count"))).toEqual([]);
        expect(requested.filter((url) => url.endsWith(".geojson"))).toEqual([
            "/api/map/admin-boundaries/1.geojson",
            "/api/map/admin-boundaries/2.geojson",
            "/api/map/admin-boundaries/3.geojson",
        ]);
        // the heavy variant of the endpoint -- the one without `geometry=false` -- is never asked for
        expect(requested).not.toContain("/api/map/admin-boundaries?admin_levels=6%2C9%2C10");
        expect(adminBoundariesStore.isLoadingBoundaries).toBe(false);
    });

    it("the district select has its list from the index, and the map its polygons", async () => {
        await adminBoundariesStore.fetchBoundaries();

        expect(adminBoundariesStore.index).toEqual([
            { id: 1, name: "Тамбовский округ", admin_level: 6 },
            { id: 2, name: "Советский район", admin_level: 9 },
            { id: 3, name: "Пехотка", admin_level: 10 },
        ]);
        // same shape as before: `Map.tsx` hands `geom` straight to YMapFeature
        expect(adminBoundariesStore.boundaries).toHaveLength(3);
        expect(adminBoundariesStore.boundaries[0]).toMatchObject({ id: 1, name: "Тамбовский округ", admin_level: 6 });
        expect(adminBoundariesStore.boundaries[0].geom.type).toBe("MultiPolygon");
    });

    it("shares one request between concurrent callers", async () => {
        await Promise.all([adminBoundariesStore.fetchBoundaries(), adminBoundariesStore.fetchBoundaries()]);

        expect(requested.filter((url) => url.endsWith(".geojson"))).toHaveLength(3);
        expect(adminBoundariesStore.boundaries).toHaveLength(3);
    });

    it("does not re-fetch once loaded; a forced reload re-reads the names but not the polygons", async () => {
        await adminBoundariesStore.fetchBoundaries();
        const first = requested.length;

        await adminBoundariesStore.fetchBoundaries();
        expect(requested).toHaveLength(first);

        // a language change forces a reload: the names are localized, the geometry is not
        requested = [];
        await adminBoundariesStore.fetchBoundaries(true);
        expect(requested).toEqual(["/api/map/admin-boundaries?admin_levels=6%2C9%2C10&geometry=false"]);
        expect(adminBoundariesStore.boundaries).toHaveLength(3);
    });

    it("does not stick after a failed request: the next caller tries again", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network down"));

        await adminBoundariesStore.fetchBoundaries();
        expect(adminBoundariesStore.boundaries).toEqual([]);
        expect(adminBoundariesStore.errorBoundaries).not.toBeNull();

        await adminBoundariesStore.fetchBoundaries();
        expect(adminBoundariesStore.boundaries).toHaveLength(3);
        expect(adminBoundariesStore.errorBoundaries).toBeNull();
    });

    it("falls back to the bulk list when no geometry can be had (a backend without .geojson)", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), "http://localhost");
            if (url.pathname.endsWith(".geojson")) {
                requested.push(url.pathname);
                return jsonResponse({ success: false, error: { message: "not found" } }, { status: 404 });
            }
            return route(input);
        });

        await adminBoundariesStore.fetchBoundaries();

        expect(adminBoundariesStore.boundaries).toHaveLength(1);
        expect(adminBoundariesStore.boundaries[0].name).toBe("bulk");
        // the index still came from the light endpoint, so the select is complete
        expect(adminBoundariesStore.index).toHaveLength(3);
    });

    /**
     * `geometry=false` only exists from backend integration/wave-6 on. An older one answers
     * 200 with the full list, so support is read off the body -- and the polygons that arrived
     * are kept rather than re-requested one `.geojson` at a time.
     */
    describe("against a backend that ignores geometry=false", () => {
        beforeEach(() => {
            fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
                const url = new URL(String(input), "http://localhost");
                if (url.pathname === "/api/map/admin-boundaries" && url.searchParams.get("geometry") === "false") {
                    requested.push(url.pathname + url.search);
                    return jsonResponse({ success: true, payload: { admin_boundaries: INDEX_WITH_GEOMETRY } });
                }
                return route(input);
            });
        });

        it("draws the boundaries from the geometry that came anyway, asking for no .geojson", async () => {
            await adminBoundariesStore.fetchBoundaries();

            expect(requested).toEqual(["/api/map/admin-boundaries?admin_levels=6%2C9%2C10&geometry=false"]);
            expect(adminBoundariesStore.index).toEqual(INDEX);
            expect(adminBoundariesStore.boundaries).toHaveLength(3);
            expect(adminBoundariesStore.boundaries[0]).toMatchObject({ id: 1, name: "Тамбовский округ", admin_level: 6 });
            expect(adminBoundariesStore.boundaries[0].geom.type).toBe("MultiPolygon");
        });

        it("does not pay the full response twice: the reload takes the marks-counter path", async () => {
            await adminBoundariesStore.fetchBoundaries();
            requested = [];

            // the verdict is remembered, so the forced reload reads the (localized) names from
            // the counter -- three light requests -- and keeps the polygons it already has
            await adminBoundariesStore.fetchBoundaries(true);

            expect(requested).toEqual([
                "/api/map/admin-boundaries/marks/count?admin_levels=6",
                "/api/map/admin-boundaries/marks/count?admin_levels=9",
                "/api/map/admin-boundaries/marks/count?admin_levels=10",
            ]);
            expect(adminBoundariesStore.boundaries).toHaveLength(3);
        });

        it("fetches the geometry a partial answer left out", async () => {
            // one boundary comes without `geom` even though the others carry it
            fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
                const url = new URL(String(input), "http://localhost");
                if (url.pathname === "/api/map/admin-boundaries" && url.searchParams.get("geometry") === "false") {
                    requested.push(url.pathname + url.search);
                    return jsonResponse({
                        success: true,
                        payload: { admin_boundaries: [INDEX_WITH_GEOMETRY[0], INDEX_WITH_GEOMETRY[1], INDEX[2]] },
                    });
                }
                return route(input);
            });

            await adminBoundariesStore.fetchBoundaries();

            expect(requested.filter((url) => url.endsWith(".geojson"))).toEqual(["/api/map/admin-boundaries/3.geojson"]);
            expect(adminBoundariesStore.boundaries).toHaveLength(3);
        });
    });
});
