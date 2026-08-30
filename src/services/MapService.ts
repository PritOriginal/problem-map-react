import BaseService, { IResponse } from "./BaseService"
import { isRecord, unwrapList } from "./http";
import { MultiPolygonGeometry, PolygonGeometry } from "@yandex/ymaps3-types";

export interface AdminBoundary {
    id: number;
    name: string;
    admin_level: number;
    geom: MultiPolygonGeometry;
}

/** A boundary without its geometry: everything a district `<select>` needs, and 0.8% of the bytes. */
export type AdminBoundaryRef = Omit<AdminBoundary, "geom">;

/** One boundary as `GET /map/admin-boundaries/{id}.geojson` serves it (a bare GeoJSON Feature). */
export interface AdminBoundaryFeature {
    type: "Feature";
    id: number;
    geometry: MultiPolygonGeometry;
    properties: {
        name: string;
        admin_level: number;
    };
}

export interface GetAdminBoundaryGeoJSONResponse extends IResponse {
    payload: AdminBoundaryFeature | null;
}

/**
 * The `.geojson` route answers with the Feature itself, not with the `{ success, payload }`
 * envelope -- `parseResponse` passes a body without `success` straight through, so the parsed
 * body *is* the Feature. An enveloped one is accepted too, in case that ever changes.
 */
function asBoundaryFeature(body: unknown): AdminBoundaryFeature | null {
    const raw = isRecord(body) && isRecord(body.payload) ? body.payload : body;
    if (!isRecord(raw) || raw.type !== "Feature" || !isRecord(raw.geometry)) {
        return null;
    }
    return raw as unknown as AdminBoundaryFeature;
}

export interface GetAdminBoundariesRequest {
    admin_levels: number[];
}

export interface GetAdminBoundariesResponse extends IResponse {
    payload: GetAdminBoundariesResponsePayload;
}

export interface GetAdminBoundariesResponsePayload {
    admin_boundaries: AdminBoundary[]
}

export interface AdminBoundaryMarksCount {
    id: number;
    name: string;
    total_count: number;
    unconfirmed_count: number;
    confirmed_count: number;
    under_review_count: number;
    closed_count: number;
}

export interface GetAdminBoundariesMarksCountRequest {
    admin_levels: number[];
    mark_type_ids: number[];
}

export interface GetAdminBoundariesMarksCountResponse extends IResponse {
    payload: GetAdminBoundariesMarksCountResponsePayload;
}

export interface GetAdminBoundariesMarksCountResponsePayload {
    admin_boundaries: AdminBoundaryMarksCount[]
}


/** Bounding box as `[minLon, minLat, maxLon, maxLat]`. */
export type BBox = [number, number, number, number];

export interface GetHeatmapRequest {
    bbox: BBox;
    cell_m: number;
    mark_type_ids: number[];
    mark_status_ids: number[];
}

export interface HeatmapFeature {
    type: "Feature";
    id?: string | number;
    geometry: PolygonGeometry;
    properties: {
        count: number;
    };
}

export interface HeatmapFeatureCollection {
    type: "FeatureCollection";
    features: HeatmapFeature[];
}

export interface GetHeatmapResponse extends IResponse {
    payload: HeatmapFeatureCollection;
}

class MapService extends BaseService {
    /** Grid heatmap of marks over the bbox (`GET /map/heatmap`). */
    public getHeatmap(req: GetHeatmapRequest): Promise<GetHeatmapResponse> {
        const params = new URLSearchParams();
        params.set("bbox", req.bbox.map((v) => v.toFixed(6)).join(","));
        params.set("cell_m", String(req.cell_m));
        if (req.mark_type_ids.length > 0) {
            params.set("mark_type_ids", req.mark_type_ids.join(","));
        }
        if (req.mark_status_ids.length > 0) {
            params.set("mark_status_ids", req.mark_status_ids.join(","));
        }
        return this.request<GetHeatmapResponse>(`/api/map/heatmap?${params}`);
    }

    /**
     * Every boundary at `admin_levels`, geometry included (`GET /map/admin-boundaries`).
     *
     * This is the heaviest response in the app: 61 boundaries, 1 080 153 bytes, of which the
     * `geom` fields are 99.2%. It is also past `ETAG_MAX_ENTRY_CHARS`, so `requestCached` cannot
     * keep the body and the whole megabyte comes down again on every start. `admin_levels` is
     * the only knob the handler has (internal/handler/map/map.go): there is no way to ask it to
     * leave the geometry out. Prefer `getAdminBoundaryIndex` + `getAdminBoundaryGeoJSON`; this
     * stays as the fallback for a backend without the `.geojson` route.
     */
    public getAdminBoundaries(req: GetAdminBoundariesRequest): Promise<GetAdminBoundariesResponse> {
        const params = new URLSearchParams();
        if (req.admin_levels.length > 0) {
            params.append("admin_levels", req.admin_levels.join(","));
        }

        return this.requestCached<GetAdminBoundariesResponse>(`/api/map/admin-boundaries?${params}`);
    }

    public getAdminBoundariesMarksCount(req: GetAdminBoundariesMarksCountRequest): Promise<GetAdminBoundariesMarksCountResponse> {
        const params = new URLSearchParams();
        if (req.admin_levels.length > 0) {
            params.append("admin_levels", req.admin_levels.join(","));
        }
        if (req.mark_type_ids.length > 0) {
            params.append("mark_type_ids", req.mark_type_ids.join(","));
        }

        return this.request<GetAdminBoundariesMarksCountResponse>(`/api/map/admin-boundaries/marks/count?${params}`);
    }

    /**
     * id + name + admin_level of every boundary at the given levels, without any geometry.
     *
     * There is no endpoint for exactly this, and one should be asked for -- see the note on
     * `getAdminBoundaries`. What the backend does have is the marks counter, which lists the
     * same boundaries and carries no geometry at all (9 595 bytes for all 61 against
     * 1 080 153). It LEFT JOINs the marks, so the set of boundaries it answers with does not
     * depend on the mark filter; it does not report `admin_level`, which is why this asks one
     * level at a time and takes the level from the request. Three requests, ~9.6 KB in all.
     *
     * `GET /map/admin-boundaries?geometry=false` would collapse this back into one call.
     */
    public getAdminBoundaryIndex(adminLevels: number[]): Promise<AdminBoundaryRef[]> {
        return Promise.all(adminLevels.map((level) => this
            .getAdminBoundariesMarksCount({ admin_levels: [level], mark_type_ids: [] })
            .then((res) => unwrapList<AdminBoundaryMarksCount>(res.payload, "admin_boundaries")
                .map((boundary): AdminBoundaryRef => ({ id: boundary.id, name: boundary.name, admin_level: level })))))
            .then((perLevel) => perLevel.flat());
    }

    /**
     * One boundary's geometry (`GET /map/admin-boundaries/{id}.geojson`).
     *
     * Deliberately *not* `requestCached`: the response carries `Cache-Control: public,
     * max-age=86400` and an `ETag`, so the browser's own HTTP cache answers it for a day
     * without a request -- and unlike localStorage (5 MB, shared with the tokens) it has room
     * for all of them. `public/sw.js` keeps a copy too, which is what makes the polygons
     * survive a reload while offline.
     */
    public getAdminBoundaryGeoJSON(id: number, init?: Pick<RequestInit, "signal">): Promise<GetAdminBoundaryGeoJSONResponse> {
        return this.request<IResponse>(`/api/map/admin-boundaries/${id}.geojson`, init)
            .then((res) => ({ success: true, payload: asBoundaryFeature(res) }));
    }

    public getDistricts() {
        return this.request("/api/map/districts")
    }
}

export default new MapService();