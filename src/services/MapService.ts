import BaseService, { IResponse } from "./BaseService"
import { MultiPolygonGeometry } from "@yandex/ymaps3-types";

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
}

export interface GetAdminBoundariesMarksCountResponse extends IResponse {
    payload: GetAdminBoundariesMarksCountResponsePayload;
}

export interface GetAdminBoundariesMarksCountResponsePayload {
    admin_boundaries: AdminBoundaryMarksCount[]
}


class MapService extends BaseService {
    public getAdminBoundaries(req: GetAdminBoundariesRequest): Promise<GetAdminBoundariesResponse> {
        const params = new URLSearchParams();
        req.admin_levels.forEach(level => {
            params.append("admin_levels", level.toString())
        });

        return fetch(`/api/map/admin-boundaries?${params}`).then(this.getResponse);
    }

     public getAdminBoundariesMarksCount(req: GetAdminBoundariesMarksCountRequest): Promise<GetAdminBoundariesMarksCountResponse> {
        const params = new URLSearchParams();
        req.admin_levels.forEach(level => {
            params.append("admin_levels", level.toString())
        });

        return fetch(`/api/map/admin-boundaries/marks/count?${params}`).then(this.getResponse);
    }

    public getDistricts() {
        return fetch("/api/map/districts").then(this.getResponse)
    }
}

export default new MapService();