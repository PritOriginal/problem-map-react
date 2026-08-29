import BaseService, { IResponse } from "./BaseService";
import { ListMeta } from "./http";
import { Mark } from "./MarksService";

export interface Organization {
    organization_id: number;
    name: string;
    description?: string;
}

export interface GetMyOrganizationResponse extends IResponse {
    payload: Organization;
}

export interface GetOrganizationsResponse extends IResponse {
    payload: Organization[];
}

export interface GetOrganizationMarksRequest {
    status_ids?: number[];
    overdue?: boolean;
    limit?: number;
    offset?: number;
}

export interface GetOrganizationMarksResponse extends IResponse {
    payload: Mark[];
    meta?: ListMeta;
}

/** Organizations / service desk (backend integration/wave-4). */
class OrganizationsService extends BaseService {
    /** Organization of the signed-in service user (`GET /organizations/me`). */
    public getMe(): Promise<GetMyOrganizationResponse> {
        return this.requestWithAuth<GetMyOrganizationResponse>("/api/organizations/me");
    }

    /** Dictionary of all organizations (`GET /organizations`). */
    public getOrganizations(): Promise<GetOrganizationsResponse> {
        return this.request<GetOrganizationsResponse>("/api/organizations");
    }

    /** Queue of marks assigned to the organization (`GET /organizations/{id}/marks`). */
    public getMarks(organizationId: number, req: GetOrganizationMarksRequest = {}): Promise<GetOrganizationMarksResponse> {
        const params = new URLSearchParams();
        if (req.status_ids && req.status_ids.length > 0) {
            params.set("status_ids", req.status_ids.join(","));
        }
        if (req.overdue) {
            params.set("overdue", "true");
        }
        if (req.limit !== undefined) {
            params.set("limit", String(req.limit));
        }
        if (req.offset !== undefined) {
            params.set("offset", String(req.offset));
        }
        const query = params.toString();
        return this.requestWithAuth<GetOrganizationMarksResponse>(`/api/organizations/${organizationId}/marks${query ? `?${query}` : ""}`);
    }
}

export default new OrganizationsService();
