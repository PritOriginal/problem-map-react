import BaseService, { IResponse, unwrapList, unwrapOne } from "./BaseService";
import { isRecord } from "./http";
import { ListMeta } from "./http";
import { Mark } from "./MarksService";

export interface Organization {
    organization_id: number;
    name: string;
    description?: string;
}

/**
 * The backend identifies organizations by `id` (`models.OrganizationRef` / `OrganizationDetails`);
 * older builds used `organization_id`. Accepts both and always fills `organization_id`.
 */
export function normalizeOrganization(raw: unknown): Organization | null {
    if (!isRecord(raw)) {
        return null;
    }
    const id = Number(raw.organization_id ?? raw.id);
    if (!Number.isFinite(id)) {
        return null;
    }
    return {
        ...raw,
        organization_id: id,
        name: String(raw.name ?? ""),
        description: typeof raw.description === "string" ? raw.description : undefined,
    };
}

export function normalizeOrganizations(payload: unknown): Organization[] {
    return unwrapList<unknown>(payload, "organizations")
        .map(normalizeOrganization)
        .filter((o): o is Organization => o !== null);
}

/** `GET /organizations/me` returns `{ organization: {...} }`; `payload` is unwrapped to the organization. */
export interface GetMyOrganizationResponse extends IResponse {
    payload: Organization | null;
}

/** `GET /organizations` returns `{ organizations: [...] }`; `payload` is unwrapped to the list. */
export interface GetOrganizationsResponse extends IResponse {
    payload: Organization[];
}

export interface GetOrganizationMarksRequest {
    status_ids?: number[];
    overdue?: boolean;
    limit?: number;
    offset?: number;
}

/** `GET /organizations/{id}/marks` returns `{ marks: Mark[] }`; `payload` is unwrapped to the list. */
export interface GetOrganizationMarksResponse extends IResponse {
    payload: Mark[];
    meta?: ListMeta;
}

/** Reads take an optional trailing `init` whose `signal` cancels a superseded request (`useAsyncData`). */
/** Organizations / service desk (backend integration/wave-4). */
class OrganizationsService extends BaseService {
    /** Organization of the signed-in service user (`GET /organizations/me`). */
    public getMe(init?: Pick<RequestInit, "signal">): Promise<GetMyOrganizationResponse> {
        return this.requestWithAuth<IResponse>("/api/organizations/me", init)
            .then((res) => ({ ...res, payload: normalizeOrganization(unwrapOne(res.payload, "organization")) }));
    }

    /**
     * Dictionary of all organizations (`GET /organizations`).
     * Anonymous and read-only, so it goes through the ETag cache (`public/sw.js` already
     * lists it as cacheable); a language change re-fetches, the key carries the language.
     */
    public getOrganizations(): Promise<GetOrganizationsResponse> {
        return this.requestCached<IResponse>("/api/organizations")
            .then((res) => ({ ...res, payload: normalizeOrganizations(res.payload) }));
    }

    /** Queue of marks assigned to the organization (`GET /organizations/{id}/marks`). */
    public getMarks(organizationId: number, req: GetOrganizationMarksRequest = {}, init?: Pick<RequestInit, "signal">): Promise<GetOrganizationMarksResponse> {
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
        return this.requestWithAuth<IResponse>(`/api/organizations/${organizationId}/marks${query ? `?${query}` : ""}`, init)
            .then((res) => ({ ...res, payload: unwrapList<Mark>(res.payload, "marks") }));
    }
}

export default new OrganizationsService();
