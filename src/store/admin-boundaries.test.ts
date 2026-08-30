import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminBoundariesStore from "./admin-boundaries";
import { jsonResponse } from "../test/fetch";

/**
 * The boundary list used to come down whole -- 61 polygons, 1 080 153 bytes, 99.2% of it
 * geometry, and past `ETAG_MAX_ENTRY_CHARS`, so the whole megabyte was re-downloaded on every
 * start. The store now reads a geometry-less index and then one cacheable `.geojson` per
 * boundary; the map still sees `boundaries` with the same shape, and the district `<select>`
 * reads `index`, which is there long before the polygons are.
 */
describe("adminBoundariesStore.fetchBoundaries", () => {
    /** id + name per admin level, as `GET /map/admin-boundaries/marks/count` answers. */
    const INDEX: Record<string, { id: number; name: string }[]> = {
        "6": [{ id: 1, name: "Тамбовский округ" }],
        "9": [{ id: 2, name: "Советский район" }],
        "10": [{ id: 3, name: "Пехотка" }],
    };

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

    /** Answers the index per level and each `.geojson` by id; anything else is a test bug. */
    function route(input: RequestInfo | URL): Response {
        const url = new URL(String(input), "http://localhost");
        requested.push(url.pathname + url.search);
        const geojson = /^\/api\/map\/admin-boundaries\/(\d+)\.geojson$/.exec(url.pathname);
        if (geojson) {
            return jsonResponse(geometryOf(Number(geojson[1])));
        }
        if (url.pathname === "/api/map/admin-boundaries/marks/count") {
            const level = url.searchParams.get("admin_levels") ?? "";
            return jsonResponse({ success: true, payload: { admin_boundaries: INDEX[level] ?? [] } });
        }
        if (url.pathname === "/api/map/admin-boundaries") {
            return jsonResponse({
                success: true,
                payload: { admin_boundaries: [{ id: 9, name: "bulk", admin_level: 6, geom: { type: "MultiPolygon", coordinates: [] } }] },
            });
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

    it("reads the index first, then one .geojson per boundary", async () => {
        await adminBoundariesStore.fetchBoundaries();

        // one index request per admin level (the counter does not report the level itself)
        expect(requested.filter((url) => url.startsWith("/api/map/admin-boundaries/marks/count"))).toEqual([
            "/api/map/admin-boundaries/marks/count?admin_levels=6",
            "/api/map/admin-boundaries/marks/count?admin_levels=9",
            "/api/map/admin-boundaries/marks/count?admin_levels=10",
        ]);
        expect(requested.filter((url) => url.endsWith(".geojson"))).toEqual([
            "/api/map/admin-boundaries/1.geojson",
            "/api/map/admin-boundaries/2.geojson",
            "/api/map/admin-boundaries/3.geojson",
        ]);
        // the heavy bulk endpoint is not touched at all
        expect(requested).not.toContain("/api/map/admin-boundaries?");
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
        expect(requested.filter((url) => url.startsWith("/api/map/admin-boundaries/marks/count"))).toHaveLength(3);
        expect(requested.filter((url) => url.endsWith(".geojson"))).toHaveLength(0);
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
});
