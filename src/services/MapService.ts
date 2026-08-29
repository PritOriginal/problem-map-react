import BaseService, { IResponse } from "./BaseService"
import { MultiPolygonGeometry, PolygonGeometry } from "@yandex/ymaps3-types";

export interface AdminBoundary {
    id: number;
    name: string;
    admin_level: number;
    geom: MultiPolygonGeometry;
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

    public getAdminBoundaries(req: GetAdminBoundariesRequest): Promise<GetAdminBoundariesResponse> {
        const params = new URLSearchParams();
        if (req.admin_levels.length > 0) {
            params.append("admin_levels", req.admin_levels.join(","));
        }

        return this.request<GetAdminBoundariesResponse>(`/api/map/admin-boundaries?${params}`);
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

    public getDistricts() {
        return this.request("/api/map/districts")
    }
}

export default new MapService();