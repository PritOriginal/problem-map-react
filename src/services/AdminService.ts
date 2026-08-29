import BaseService, { IResponse } from "./BaseService";
import { MarkType, normalizeMarkTypes } from "./MarksService";

/** `GET/PUT /admin/settings` (backend integration/wave-5). */
export interface AdminSettings {
    vote_threshold: number;
    dedup_radius_m: number;
    max_checks_per_day: number;
    rating: {
        check_correct: number;
        check_wrong: number;
        mark_confirmed: number;
        mark_refuted: number;
        task_completed: number;
    };
    tasker: {
        max_tasks_per_user: number;
        target_probability: number;
        max_radius_meters: number;
        /** Go duration string, e.g. `24h`. */
        task_ttl: string;
    };
}

export interface GetSettingsResponse extends IResponse {
    payload: AdminSettings;
}

/** Full mark type row for the admin table (`GET /admin/mark-types`). */
export interface AdminMarkType extends MarkType {
    code: string;
    name_ru: string;
    name_en: string;
    icon: string;
    color: string;
    sla_hours: number;
    active: boolean;
    sort_order: number;
}

export interface AddMarkTypeRequest {
    code: string;
    name_ru: string;
    name_en: string;
    icon: string;
    color: string;
    sla_hours: number;
}

export interface UpdateMarkTypeRequest extends Partial<AddMarkTypeRequest> {
    active?: boolean;
    sort_order?: number;
}

export interface GetAdminMarkTypesResponse extends IResponse {
    payload: AdminMarkType[];
}

export interface MarkTypeResponse extends IResponse {
    payload: AdminMarkType;
}

/** `GET /api-keys`; the secret is only returned by `POST /api-keys`. */
export interface ApiKey {
    id: number;
    name: string;
    /** Prefix / masked form when the backend provides one. */
    prefix?: string;
    created_at: string;
    last_used_at?: string | null;
}

export interface CreatedApiKey extends ApiKey {
    /** The full key, shown once. */
    key: string;
}

export interface GetApiKeysResponse extends IResponse {
    payload: ApiKey[];
}

export interface CreateApiKeyResponse extends IResponse {
    payload: CreatedApiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** Accepts `{ id | mark_type_id, ... }` rows and fills defaults for the admin table. */
export function normalizeAdminMarkTypes(payload: unknown): AdminMarkType[] {
    const list = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.mark_types) ? payload.mark_types : [];
    return normalizeMarkTypes(list).map((base, index) => {
        const raw = list[index] as Record<string, unknown>;
        return {
            ...base,
            code: base.code ?? "",
            name_ru: typeof raw.name_ru === "string" ? raw.name_ru : base.name,
            name_en: typeof raw.name_en === "string" ? raw.name_en : "",
            icon: base.icon ?? "",
            color: base.color ?? "",
            sla_hours: typeof raw.sla_hours === "number" ? raw.sla_hours : 0,
            active: raw.active !== false,
            sort_order: base.sort_order ?? 0,
        };
    });
}

const JSON_HEADERS = { "Content-Type": "application/json;charset=utf-8" };

/** Admin settings, mark types and API keys (backend integration/wave-5, role admin). */
class AdminService extends BaseService {
    public getSettings(): Promise<GetSettingsResponse> {
        return this.requestWithAuth<GetSettingsResponse>("/api/admin/settings");
    }

    public updateSettings(settings: AdminSettings): Promise<GetSettingsResponse> {
        return this.requestWithAuth<GetSettingsResponse>("/api/admin/settings", {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify(settings),
        });
    }

    /** All mark types, including inactive ones. */
    public getMarkTypes(): Promise<GetAdminMarkTypesResponse> {
        return this.requestWithAuth<IResponse>("/api/admin/mark-types")
            .then((res) => ({ ...res, payload: normalizeAdminMarkTypes(res.payload) }));
    }

    public addMarkType(req: AddMarkTypeRequest): Promise<MarkTypeResponse> {
        return this.requestWithAuth<MarkTypeResponse>("/api/admin/mark-types", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify(req),
        });
    }

    public updateMarkType(id: number, req: UpdateMarkTypeRequest): Promise<MarkTypeResponse> {
        return this.requestWithAuth<MarkTypeResponse>(`/api/admin/mark-types/${id}`, {
            method: "PATCH",
            headers: JSON_HEADERS,
            body: JSON.stringify(req),
        });
    }

    public getApiKeys(): Promise<GetApiKeysResponse> {
        return this.requestWithAuth<GetApiKeysResponse>("/api/api-keys")
            .then((res) => ({ ...res, payload: Array.isArray(res.payload) ? res.payload : [] }));
    }

    /** The returned `key` is shown once and never returned again. */
    public createApiKey(name: string): Promise<CreateApiKeyResponse> {
        return this.requestWithAuth<CreateApiKeyResponse>("/api/api-keys", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ name }),
        });
    }

    public revokeApiKey(id: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/api-keys/${id}`, { method: "DELETE" });
    }
}

export default new AdminService();
