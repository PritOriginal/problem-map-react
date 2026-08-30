import { LngLat } from "@yandex/ymaps3-types";
import BaseService, { IResponse, withIdempotencyKey } from "./BaseService"
import { PointGeometry } from "@yandex/ymaps3-types";
import { Check } from "./ChecksService";
import { isRecord, unwrapList } from "./http";
import type { ErrorInfo } from "./http";
import { t } from "../i18n";
import type { BBox } from "./MapService";
import { parseSimilarMarks } from "../utils/similar";
import { mapWithLimit } from "../utils/concurrency";


export interface Mark {
    mark_id: number;
    name: string;
    geom: PointGeometry,
    mark_type_id: number;
    description: string;
    user_id: number;
    mark_status_id: number;
    created_at: string;
    updated_at: string;
    /** Number of users following the mark (backend integration/wave-3). */
    followers_count?: number;
    /** Whether the current user follows the mark (only meaningful when authorized). */
    is_following?: boolean;
    /** Organization assigned to the mark (backend integration/wave-4); null when none. */
    organization_id?: number | null;
    /** SLA deadline for the assigned organization (ISO date-time); null when none. */
    sla_due_at?: string | null;
    /** True when `sla_due_at` has passed and the mark is still not resolved. */
    is_overdue?: boolean;
    /** Hidden by a moderator (backend integration/wave-5); still visible to moderators. */
    hidden?: boolean;
    /** Id of the original when the mark was merged as a duplicate (status 8); null otherwise. */
    merged_into_id?: number | null;
    /** Number of (non-deleted) comments. */
    comments_count?: number;
}

/** A mark near the point being reported, with the distance to it in meters. */
export type SimilarMark = Mark & { distance_m: number };

export interface GetSimilarMarksRequest {
    point: Point;
    mark_type_id: number;
    /** Search radius in meters (backend default when omitted). */
    radius?: number;
}

/** `GET /marks/similar` returns `{ marks: [...] }`; `payload` is unwrapped to the list. */
export interface GetSimilarMarksResponse extends IResponse {
    payload: SimilarMark[];
}

export interface UpdateMarkRequest {
    description?: string;
    mark_type_id?: number;
}

/** `POST/DELETE /marks/{id}/follow` return `{ mark_id, following }`. */
export interface FollowMarkResponse extends IResponse {
    payload?: {
        mark_id?: number;
        following?: boolean;
        followers_count?: number;
    };
}

export interface MarkType {
    mark_type_id: number;
    name: string;
    /** Language-independent code (backend integration/wave-4). */
    code?: string;
    /** Emoji / icon code for the marker (backend integration/wave-5); empty when the backend has none. */
    icon?: string;
    /** CSS color of the marker (`#rrggbb`); empty when the backend has none. */
    color?: string;
    sort_order?: number;
}

export interface MarkStatus {
    mark_status_id: number;
    name: string;
    parent_id: number | null;
    /** Language-independent code (backend integration/wave-4). */
    code?: string;
}

export enum MarkStatusType {
    UnconfirmedStatus = 1,
	ConfirmedStatus,
	UnderReviewStatus,
	RediscoveredStatus,
	ClosedStatus,
	RefutedStatus,
	/** Taken by an organization (backend integration/wave-4). */
	InWorkStatus,
	/** Merged into another mark (backend integration/wave-5). */
	DuplicateStatus,
}

/** Export formats of `GET /marks/export`. */
export type ExportFormat = "geojson" | "csv";

/**
 * Wave-4 dictionaries come as `{ id, code, name }` (localized `name`); older backends
 * return `{ mark_type_id, name }` in `payload.mark_types`. Accept both shapes.
 */
function dictList(payload: unknown, legacyKey: string): Record<string, unknown>[] {
    return unwrapList<unknown>(payload, legacyKey).filter(isRecord);
}

function dictId(item: Record<string, unknown>, legacyKey: string): number {
    const id = item.id ?? item[legacyKey];
    return typeof id === "number" ? id : Number(id);
}

export function normalizeMarkTypes(payload: unknown): MarkType[] {
    return dictList(payload, "mark_types")
        .map((item) => ({
            mark_type_id: dictId(item, "mark_type_id"),
            name: String(item.name ?? ""),
            code: typeof item.code === "string" ? item.code : undefined,
            icon: typeof item.icon === "string" && item.icon !== "" ? item.icon : undefined,
            color: typeof item.color === "string" && item.color !== "" ? item.color : undefined,
            sort_order: typeof item.sort_order === "number" ? item.sort_order : undefined,
        }))
        .sort(byMarkTypeOrder);
}

/**
 * Dictionary order: `sort_order` only, types without one last.
 *
 * No tie-break on id, on purpose. The backend orders the dictionary by
 * `sort_order, name, type_mark_id`, and every type currently carries `sort_order: 0`,
 * so its answer is sorted by NAME. Breaking the tie on id here re-sorted that answer
 * into id order and threw the naming away -- the list came back
 * Дорога, Зелёные зоны, Информационные…, Мусор, Освещение and was shown as
 * Мусор, Зелёные зоны, Дорога, Освещение, Информационные…
 *
 * `Array.prototype.sort` is stable, so ties keep the order the backend sent, which
 * is the one place that knows how to collate the translated names.
 *
 * Exported because the admin normalizer sorts the same list again, and the two orders
 * drifting apart is what produced rows that mixed one type's name with another's code.
 */
export function byMarkTypeOrder(a: MarkType, b: MarkType): number {
    return (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
}

export function normalizeMarkStatuses(payload: unknown): MarkStatus[] {
    return dictList(payload, "mark_statuses").map((item) => ({
        mark_status_id: dictId(item, "mark_status_id"),
        name: String(item.name ?? ""),
        parent_id: typeof item.parent_id === "number" ? item.parent_id : null,
        code: typeof item.code === "string" ? item.code : undefined,
    }));
}

export interface AddMarkRequest {
    point: Point
    mark_type_id: number
    description: string
}

/**
 * Converts ymaps3 `LngLat` (= [lng, lat]) into the point fields the backend expects:
 * longitude = coords[0], latitude = coords[1] (natural order).
 * ВНИМАНИЕ: требует бэкенд с фиксом `fix/coords-lonlat` (handler/marks AddMark собирает
 * точку как Coord{Longitude, Latitude}). На старом бэкенде, который клал поле latitude в X,
 * метки будут перепутаны местами (lng/lat).
 */
export function toApiPoint([lng, lat]: LngLat): Point {
    return { longitude: lng, latitude: lat };
}

export interface AddMarkResponse extends IResponse {
    payload: AddMarkResponsePayload;
}

export interface AddMarkResponsePayload {
    mark_id: number;
}

export interface Point {
    longitude: number
    latitude: number
}

/** Max elements `POST /marks/batch` accepts in one request; longer lists are split. */
export const MARKS_BATCH_MAX = 20;

/** Max photos the batch route accepts per element. */
export const MARKS_BATCH_MAX_PHOTOS = 5;

/** One element of `POST /marks/batch`; `key` is the `Idempotency-Key` of that single mark. */
export interface BatchMarkItem {
    key?: string;
    longitude: number;
    latitude: number;
    mark_type_id: number;
    description?: string;
    force?: boolean;
    photos: Blob[];
}

/**
 * Outcome of one element: `created` — new mark, `replayed` — the same `key` had already been
 * applied, `duplicate` — collapsed into a mark that was already there, `failed` — see `error`.
 */
export type BatchMarkStatus = "created" | "replayed" | "duplicate" | "failed";

export interface BatchMarkResult {
    /** Index in the request, so results can be paired up without relying on the array order. */
    index: number;
    key?: string;
    status: BatchMarkStatus;
    mark_id?: number;
    error?: ErrorInfo;
    similar_marks?: SimilarMark[];
}

/** Builds the multipart body: `items` as JSON, files as `photos.<index>`. */
function batchFormData(items: BatchMarkItem[]): FormData {
    const form = new FormData();
    const photos = items.map((item) => item.photos.slice(0, MARKS_BATCH_MAX_PHOTOS));
    form.append("items", JSON.stringify(items.map((item, i) => ({
        key: item.key,
        longitude: item.longitude,
        latitude: item.latitude,
        mark_type_id: item.mark_type_id,
        description: item.description ?? "",
        force: item.force ?? false,
        // the count the backend uses to slice `photos.<i>` back apart, hence the same cap
        photos: photos[i].length,
    }))));
    photos.forEach((files, i) => {
        files.forEach((file) => {
            form.append(`photos.${i}`, file);
        });
    });
    return form;
}

/**
 * Normalizes the batch answer. The results come keyed (`{ results: [...] }`) or bare; an element
 * the backend did not answer for is reported as `failed` rather than silently treated as sent —
 * the queue must never drop a record it has no confirmation for.
 */
export function normalizeBatchResults(payload: unknown, items: BatchMarkItem[]): BatchMarkResult[] {
    const raw = unwrapList<unknown>(payload, "results").filter(isRecord);
    const byIndex = new Map<number, Record<string, unknown>>();
    raw.forEach((entry, i) => {
        const index = typeof entry.index === "number" ? entry.index : i;
        byIndex.set(index, entry);
    });
    return items.map((item, index) => {
        const entry = byIndex.get(index);
        if (!entry) {
            return { index, key: item.key, status: "failed" as const, error: { message: t("offline.batchNoResult") } };
        }
        const status = entry.status;
        return {
            index,
            key: typeof entry.key === "string" ? entry.key : item.key,
            status: isBatchStatus(status) ? status : "failed",
            mark_id: typeof entry.mark_id === "number" ? entry.mark_id : undefined,
            error: isRecord(entry.error)
                ? { message: String(entry.error.message ?? ""), code: typeof entry.error.code === "string" ? entry.error.code : undefined }
                : undefined,
            similar_marks: entry.similar_marks === undefined ? undefined : parseSimilarMarks(entry.similar_marks),
        };
    });
}

function isBatchStatus(value: unknown): value is BatchMarkStatus {
    return value === "created" || value === "replayed" || value === "duplicate" || value === "failed";
}

/**
 * Backend cap on `limit` for `GET /marks`. Omitting `limit` altogether does **not** mean
 * "everything": the backend then falls back to its own default of 100, which is how the map
 * used to silently drop every mark past the hundredth.
 */
export const MARKS_MAX_LIMIT = 500;

/** Max ids `GET /marks?ids=` accepts in one request; longer lists have to be split. */
export const MARKS_IDS_BATCH = 100;

/** How many `?ids=` batches run at once when the list is longer than one batch. */
const MARKS_IDS_CONCURRENCY = 4;

export interface GetMarksRequest {
    mark_type_ids: number[];
    mark_status_ids: number[];
    /** Page size, 1..`MARKS_MAX_LIMIT`. Omitted -> the backend's own default of 100. */
    limit?: number;
    /** Index of the first mark of the page; pairs with `limit`. */
    offset?: number;
    /** Viewport filter `[minLon, minLat, maxLon, maxLat]` in WGS84 (same shape as the heatmap's). */
    bbox?: BBox;
}

export interface GetMarksResponse extends IResponse {
    payload: GetMarksResponsePayload;
}

export interface GetMarksResponsePayload {
    marks: Mark[]
}

export interface GetMarkByIdResponse extends IResponse {
    payload: GetMarkByIdResponsePayload;
}

export interface GetMarkByIdResponsePayload {
    mark: Mark
}

export interface GetMarksByUserIdResponse extends IResponse {
    payload: GetMarksByUserIdResponsePayload;
}

export interface GetMarksByUserIdResponsePayload {
    marks: Mark[]
}

export interface GetMarkTypesResponse extends IResponse {
    payload: MarkType[];
}

export interface GetMarkStatusesResponse extends IResponse {
    payload: MarkStatus[];
}

export interface ModerateMarkResponse extends IResponse {
    payload: {
        new_mark_staus_id: number;
    };
}

export interface MarkStatusHistoryItem {
    id: number;
    mark_id: number;
    old_mark_status_id: number | null;
    new_mark_status_id: number;
    changed_at: string;
    checks?: Check[]; 
}

/** `GET /marks/changes?since=` (backend integration/wave-5). */
export interface MarkChanges {
    marks: Mark[];
    deleted_ids: number[];
    hidden_ids: number[];
    /** Server clock at the time of the response; pass it as `since` next time. */
    server_time: string;
}

export interface GetMarkChangesResponse extends IResponse {
    payload: MarkChanges;
}

/** Normalizes a changes payload: missing lists become empty. */
export function normalizeMarkChanges(payload: unknown): MarkChanges {
    const p = isRecord(payload) ? payload : {};
    const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);
    return {
        marks: Array.isArray(p.marks) ? (p.marks as Mark[]) : [],
        deleted_ids: ids(p.deleted_ids),
        hidden_ids: ids(p.hidden_ids),
        server_time: typeof p.server_time === "string" ? p.server_time : new Date().toISOString(),
    };
}

export interface GetMarkStatusHistoryByMarkIdResponse extends IResponse {
    payload: GetMarkStatusHistoryByMarkIdResponsePayload
}

export interface GetMarkStatusHistoryByMarkIdResponsePayload {
    items: MarkStatusHistoryItem[];
}

/** Reads take an optional trailing `init` whose `signal` cancels a superseded request (`useAsyncData`). */
class MarksService extends BaseService {
    /**
     * `GET /marks?mark_type_ids=&mark_status_ids=&limit=&offset=&bbox=` returns `{ marks: Mark[] }`
     * plus `meta: { limit, offset, total }` — `total` is the number of marks matching the filters,
     * regardless of the page, so the caller can tell a full answer from a truncated one.
     * `init.signal` lets the caller cancel a superseded request (see `src/store/marks.ts`).
     */
    public getMarks(req: GetMarksRequest, init?: Pick<RequestInit, "signal">): Promise<GetMarksResponse> {
        return this.request<GetMarksResponse>(`/api/marks?${this.filterParams(req)}`, init)
    }

    /**
     * `GET /marks?ids=1,2,3` — the batch read behind the task and moderation lists, which used to
     * issue one `GET /marks/{id}` per card. The backend accepts at most `MARKS_IDS_BATCH` ids, so
     * longer lists are split into batches (a few in flight at a time) and the pages concatenated;
     * an empty list resolves to `[]` without touching the network.
     *
     * Returns the marks themselves rather than an envelope: a split list has no single envelope,
     * and every caller wants the flat list. Ids the backend does not know are simply absent, and a
     * failed batch is dropped — the caller renders the cards it could fill, exactly as the
     * per-card load did.
     */
    public async getMarksByIds(ids: number[], init?: Pick<RequestInit, "signal">): Promise<Mark[]> {
        if (ids.length === 0) {
            return [];
        }
        const batches: number[][] = [];
        for (let i = 0; i < ids.length; i += MARKS_IDS_BATCH) {
            batches.push(ids.slice(i, i + MARKS_IDS_BATCH));
        }
        const settled = await mapWithLimit(batches, MARKS_IDS_CONCURRENCY, (batch) =>
            this.request<IResponse>(`/api/marks?ids=${batch.join(",")}`, init));
        const marks: Mark[] = [];
        for (const result of settled) {
            if (result.status === "fulfilled") {
                marks.push(...unwrapList<Mark>(result.value.payload, "marks"));
            }
        }
        return marks;
    }

    public getMarkById(id: number, init?: Pick<RequestInit, "signal">): Promise<GetMarkByIdResponse> {
        return this.request<GetMarkByIdResponse>(`/api/marks/${id}`, init)
    }

    public getMarksByUserId(userId: number, init?: Pick<RequestInit, "signal">): Promise<GetMarksByUserIdResponse> {
        return this.request<GetMarksByUserIdResponse>(`/api/marks/user/${userId}`, init)
    }

    /** Marks of the same type near the point. */
    public getSimilarMarks(req: GetSimilarMarksRequest, init?: Pick<RequestInit, "signal">): Promise<GetSimilarMarksResponse> {
        const params = new URLSearchParams({
            lon: String(req.point.longitude),
            lat: String(req.point.latitude),
            mark_type_id: String(req.mark_type_id),
        });
        if (req.radius !== undefined) {
            params.set("radius", String(req.radius));
        }
        return this.request<IResponse>(`/api/marks/similar?${params}`, init)
            .then((res) => ({ ...res, payload: parseSimilarMarks(res.payload) }));
    }

    /**
     * Creates a mark. Without `force` the backend may reject with 409 when similar marks
     * exist nearby (`ApiError.payload.similar_marks`); pass `force = true` to create anyway.
     */
    public addMark(req: AddMarkRequest, photos: Blob[], force: boolean = false, idempotencyKey?: string): Promise<AddMarkResponse> {
        const form = new FormData();
        form.append("longitude", req.point.longitude.toString());
        form.append("latitude", req.point.latitude.toString());
        form.append("mark_type_id", req.mark_type_id.toString());
        form.append("description", req.description);
        photos.forEach(photo => {
            form.append("photos", photo)
        });

        return this.requestWithAuth<AddMarkResponse>(`/api/marks${force ? "?force=true" : ""}`, withIdempotencyKey({
            method: "POST",
            body: form
        }, idempotencyKey))
    }

    /**
     * `POST /marks/batch` (multipart, backend integration/wave-6): creates several marks in one
     * request, applied server-side **in the order they are listed**. That order is the whole point
     * — it is what lets the backend's own de-duplication collapse two nearby marks recorded
     * offline, which a set of parallel single requests could not (see `OfflineQueueStore.flush`).
     *
     * The list is split into chunks of `MARKS_BATCH_MAX` sent **sequentially**, for the same
     * reason. The returned results keep the request order and their `index` is rewritten to the
     * index in `items`, so the caller can pair them up without tracking chunk offsets.
     *
     * A chunk that fails rejects the whole call and the results of earlier chunks are lost — but
     * not their effect: every element carries its own `key` (the queued item's
     * `Idempotency-Key`), so re-sending it, by batch or one by one, answers `replayed` instead of
     * creating a second mark. This is also what makes the 404 fallback on an old backend safe.
     *
     * Throws `ApiError` 404 when the route does not exist (backend without wave-6), 400
     * (`invalid_items` / `too_many_items`) and 413 (body over the limit).
     */
    public async addMarksBatch(items: BatchMarkItem[]): Promise<BatchMarkResult[]> {
        const results: BatchMarkResult[] = [];
        for (let start = 0; start < items.length; start += MARKS_BATCH_MAX) {
            const chunk = items.slice(start, start + MARKS_BATCH_MAX);
            const res = await this.requestWithAuth<IResponse>("/api/marks/batch", {
                method: "POST",
                body: batchFormData(chunk),
            });
            results.push(...normalizeBatchResults(res.payload, chunk).map((r) => ({ ...r, index: start + r.index })));
        }
        return results;
    }

    /** Marks changed since `since` (ISO date-time), plus deleted / hidden ids (`GET /marks/changes`). */
    public getMarkChanges(since: string): Promise<GetMarkChangesResponse> {
        return this.request<IResponse>(`/api/marks/changes?since=${encodeURIComponent(since)}`)
            .then((res) => ({ ...res, payload: normalizeMarkChanges(res.payload) }));
    }

    /** Moderator/admin: hides or shows the mark (`PATCH /marks/{id}/hidden`). */
    public setMarkHidden(id: number, hidden: boolean): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}/hidden`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ hidden }),
        })
    }

    /** Moderator/admin: merges the mark into `targetId` as a duplicate; resolves with the target mark. */
    public mergeMark(id: number, targetId: number): Promise<GetMarkByIdResponse & { payload: Mark }> {
        return this.requestWithAuth<IResponse>(`/api/marks/${id}/merge-into/${targetId}`, { method: "POST" })
            .then((res) => {
                const payload = res.payload as Mark | { mark: Mark } | undefined;
                const mark = payload && "mark" in payload ? payload.mark : (payload as Mark);
                return { ...res, payload: mark } as GetMarkByIdResponse & { payload: Mark };
            })
    }

    /** Owner only (unconfirmed mark): updates description and/or type. */
    public updateMark(id: number, req: UpdateMarkRequest): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify(req),
        })
    }

    /** Owner only (unconfirmed mark): deletes the mark. */
    public deleteMark(id: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}`, { method: "DELETE" })
    }

    public followMark(id: number): Promise<FollowMarkResponse> {
        return this.requestWithAuth<FollowMarkResponse>(`/api/marks/${id}/follow`, { method: "POST" })
    }

    public unfollowMark(id: number): Promise<FollowMarkResponse> {
        return this.requestWithAuth<FollowMarkResponse>(`/api/marks/${id}/follow`, { method: "DELETE" })
    }

    /** Moderator/admin only: confirms the mark and moves it to a new status. */
    public confirmMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/confirm`, { method: "POST" })
    }

    /** Moderator/admin only: rejects the mark and moves it to a new status. */
    public rejectMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/reject`, { method: "POST" })
    }

    public getMarkTypes(): Promise<GetMarkTypesResponse> {
        return this.requestCached<IResponse>("/api/marks/types")
            .then((res) => ({ ...res, payload: normalizeMarkTypes(res.payload) }));
    }

    public getMarkStatuses(): Promise<GetMarkStatusesResponse> {
        return this.requestCached<IResponse>("/api/marks/statuses")
            .then((res) => ({ ...res, payload: normalizeMarkStatuses(res.payload) }));
    }

    /** Service (organization staff): Confirmed -> In work (`POST /marks/{id}/start`). */
    public startMark(id: number): Promise<ModerateMarkResponse> {
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/start`, { method: "POST" })
    }

    /** Service: In work -> Under review with a report (`POST /marks/{id}/resolve`, multipart). */
    public resolveMark(id: number, comment: string, photos: File[]): Promise<ModerateMarkResponse> {
        const form = new FormData();
        form.append("comment", comment);
        photos.forEach((photo) => {
            form.append("photos", photo);
        });
        return this.requestWithAuth<ModerateMarkResponse>(`/api/marks/${id}/resolve`, { method: "POST", body: form })
    }

    /** Moderator/admin: assigns the mark to an organization (`PATCH /marks/{id}/assign`). */
    public assignMark(id: number, organizationId: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/marks/${id}/assign`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ organization_id: organizationId }),
        })
    }

    /** URL of `GET /marks/export` for the given filters (opened by the browser as a download). */
    public exportUrl(req: GetMarksRequest, format: ExportFormat): string {
        const params = this.filterParams(req);
        params.set("format", format);
        return `/api/marks/export?${params}`;
    }

    private filterParams(req: GetMarksRequest): URLSearchParams {
        const params = new URLSearchParams();
        if (req.mark_type_ids.length > 0) {
            params.append("mark_type_ids", req.mark_type_ids.join(","));
        }
        if (req.mark_status_ids.length > 0) {
            params.append("mark_status_ids", req.mark_status_ids.join(","));
        }
        if (req.bbox) {
            params.append("bbox", req.bbox.join(","));
        }
        if (req.limit !== undefined) {
            params.append("limit", String(req.limit));
        }
        if (req.offset !== undefined) {
            params.append("offset", String(req.offset));
        }
        return params;
    }

    public getMarkStatusHistoryByMarkId(id: number, withChecks: boolean, init?: Pick<RequestInit, "signal">): Promise<GetMarkStatusHistoryByMarkIdResponse> {
        return this.request<GetMarkStatusHistoryByMarkIdResponse>(`/api/marks/${id}/status-history?withChecks=${withChecks}`, init)
    }
}

export default new MarksService();