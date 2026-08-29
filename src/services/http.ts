import { t } from "../i18n";

/** Pagination block returned by list endpoints (`listquery`). */
export interface ListMeta {
    limit: number;
    offset: number;
    total: number;
}

export interface IResponse {
    success: boolean;
    error?: {
        message: string;
    };
    payload?: unknown;
    meta?: ListMeta;
}

/**
 * Error returned by the backend API (or a transport failure), with the HTTP status.
 * `payload` keeps the body payload of an error response (e.g. `similar_marks` on 409).
 */
export class ApiError extends Error {
    status: number;
    payload?: unknown;

    constructor(message: string, status: number, payload?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.payload = payload;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
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
        throw new ApiError(message, response.status, body?.payload);
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
