import { t } from "../i18n";

/** Pagination block returned by list endpoints (`listquery`). */
export interface ListMeta {
    limit: number;
    offset: number;
    total: number;
}

/**
 * Error block of the envelope. `code` is the machine-readable reason (backend
 * integration/wave-6): `similar_marks`, `idempotency_in_flight`, `idempotency_key_reused`,
 * `invalid_items`, `too_many_items`. Older backends send only `message`, so every reader
 * must still behave sensibly when it is absent.
 */
export interface ErrorInfo {
    message: string;
    code?: string;
}

export interface IResponse {
    success: boolean;
    error?: ErrorInfo;
    payload?: unknown;
    meta?: ListMeta;
}

/** Extra fields carried by an error response beyond message/status. */
export interface ApiErrorInit {
    /** `error.code` from the envelope; `undefined` on a backend that does not send one. */
    code?: string;
    /** `Retry-After` in seconds (425 while an idempotent request is still in flight). */
    retryAfter?: number;
}

/**
 * Error returned by the backend API (or a transport failure), with the HTTP status.
 * `payload` keeps the body payload of an error response (e.g. `similar_marks` on 409).
 */
export class ApiError extends Error {
    status: number;
    payload?: unknown;
    /** Machine-readable reason from `error.code`; absent on older backends. */
    code?: string;
    /** Seconds from `Retry-After`, when the backend asked to wait before retrying. */
    retryAfter?: number;

    constructor(message: string, status: number, payload?: unknown, init: ApiErrorInit = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.payload = payload;
        this.code = init.code;
        this.retryAfter = init.retryAfter;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

/**
 * `Retry-After` is either a number of seconds or an HTTP date; both are reduced to seconds
 * from now. Anything unparsable (or a past date) yields `undefined` — the caller then retries
 * on its own schedule, exactly as before the header existed.
 */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
    if (!value) {
        return undefined;
    }
    const seconds = Number(value.trim());
    if (Number.isFinite(seconds)) {
        return seconds >= 0 ? seconds : undefined;
    }
    const at = Date.parse(value);
    if (Number.isNaN(at)) {
        return undefined;
    }
    return Math.max(0, (at - now) / 1000);
}

export function getErrorMessage(error: unknown, fallback: string = t("common.error")): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === "string" && error) {
        return error;
    }
    return fallback;
}

/**
 * Parses a fetch Response. On a non-OK status (or `success: false` in the body)
 * rejects with an ApiError whose message is taken from the backend body
 * (`{ success, error: { message } }`) when available.
 */
export async function parseResponse<T extends IResponse = IResponse>(response: Response): Promise<T> {
    let body: Partial<IResponse> | null = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (!response.ok || (body !== null && body.success === false)) {
        const message = body?.error?.message
            || response.statusText
            || `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, body?.payload, {
            code: body?.error?.code,
            retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
        });
    }

    // an OK response without a JSON body (or an already consumed one) is still a success
    return (body ?? { success: true }) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The backend wraps most lists in an object keyed by the collection name
 * (`{ tasks: Task[] }`, `{ marks: Mark[] }`, …). Accepts that shape, a bare array
 * (older backends / fixtures) and `null`/`undefined` (→ `[]`), so callers always get an array.
 */
export function unwrapList<T>(payload: unknown, key: string): T[] {
    if (Array.isArray(payload)) {
        return payload as T[];
    }
    if (isRecord(payload) && Array.isArray(payload[key])) {
        return payload[key] as T[];
    }
    return [];
}

/**
 * Same for single objects: `{ user: {...} }` or a bare `{...}`. `null`/`undefined`
 * (or a wrapper whose `key` is not an object) yields `null`.
 */
export function unwrapOne<T>(payload: unknown, key: string): T | null {
    if (!isRecord(payload)) {
        return null;
    }
    if (key in payload) {
        const inner = payload[key];
        return isRecord(inner) ? (inner as T) : null;
    }
    return payload as T;
}
