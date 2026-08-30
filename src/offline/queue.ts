import type { QueuedItem, QueuedPayload, QueuedPhoto } from "./types";
import { ApiError } from "../services/http";

/** UUID v4 for `Idempotency-Key` (`crypto.randomUUID` is unavailable on insecure origins). */
export function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function toQueuedPhotos(files: File[]): QueuedPhoto[] {
    return files.map((file) => ({ name: file.name, type: file.type, blob: file }));
}

export function fromQueuedPhotos(photos: QueuedPhoto[]): File[] {
    return photos.map((photo) => new File([photo.blob], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" }));
}

export function createQueuedItem(userId: number, payload: QueuedPayload, id: string = newIdempotencyKey(), now: Date = new Date()): QueuedItem {
    return { id, user_id: userId, created_at: now.toISOString(), attempts: 0, last_error: null, payload };
}

/**
 * Whether a failed request should be queued for a later retry: the browser is offline or the
 * request never reached the backend (`TypeError` from fetch). Backend rejections (4xx/5xx) are
 * shown to the user instead.
 */
export function isNetworkFailure(error: unknown, online: boolean = typeof navigator === "undefined" ? true : navigator.onLine): boolean {
    if (!online) {
        return true;
    }
    if (error instanceof ApiError) {
        return false;
    }
    return error instanceof TypeError;
}

/**
 * What to do with a queued item whose send failed.
 *
 * - `applied` — the backend already has it (de-duplicated): drop it as a success;
 * - `discard`  — it will never be accepted with this key: drop it, but do **not** report it
 *   as sent;
 * - `retry`   — keep it in the queue and try again later.
 */
export type QueueDisposition = "applied" | "discard" | "retry";

/**
 * Maps an HTTP status plus the machine-readable `error.code` (backend integration/wave-6) to a
 * disposition. Both the old and the new backend go through here:
 *
 * - `similar_marks` (409) is the de-duplication the queue has always relied on — an active mark of
 *   the same type is already inside the radius, so the item is dropped as applied. A **bare** 409
 *   means the same thing: it is the only meaning 409 had on these routes before codes existed, and
 *   production still runs that backend.
 * - `idempotency_in_flight` (425 Too Early) is the case this classification exists for. The old
 *   backend answered it with a 409 too, so "any 409 is final" silently deleted what the user had
 *   recorded offline while the first attempt was still running. It is now a retry.
 * - `idempotency_key_reused` (422) is spent: the key was already used with different fields, so
 *   replaying it can only fail again. The item leaves the queue, but as a rejection, not a success.
 * - Anything else stays in the queue, which is what the old code did with every non-409 error.
 *
 * A bare 422 without a code is deliberately **not** a discard: an old backend sends no codes at
 * all, and dropping a user's record on a plain validation error is the very failure mode this
 * change is undoing.
 */
export function classifyFailure(status: number | undefined, code: string | undefined): QueueDisposition {
    switch (code) {
        case "similar_marks":
            return "applied";
        case "idempotency_key_reused":
            return "discard";
        case "idempotency_in_flight":
            return "retry";
    }
    if (status === 409 && !code) {
        return "applied";
    }
    return "retry";
}

/** `classifyFailure` for a thrown error; non-`ApiError` (network, sign-out) is always a retry. */
export function dispositionOf(error: unknown): QueueDisposition {
    if (!(error instanceof ApiError)) {
        return "retry";
    }
    return classifyFailure(error.status, error.code);
}

/**
 * Whether a failed send should be dropped from the queue *as applied*. A 2xx removes the item, a
 * network failure keeps it; a backend error keeps it too unless the conflict means the request was
 * already applied (see `classifyFailure`).
 */
export function isFinalFailure(error: unknown): boolean {
    return dispositionOf(error) === "applied";
}

/** Longest wait a `Retry-After` can impose on a flush; beyond it the queue just tries next time. */
export const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Delay a `Retry-After` asks for, in ms (0 when the backend sent none). Capped, and never
 * negative: a hostile or skewed value must not park the queue for hours.
 */
export function retryDelayMs(error: unknown, max: number = MAX_RETRY_AFTER_MS): number {
    if (!(error instanceof ApiError) || error.retryAfter === undefined || !Number.isFinite(error.retryAfter)) {
        return 0;
    }
    return Math.min(Math.max(0, Math.round(error.retryAfter * 1000)), max);
}

/**
 * 425 Too Early / `idempotency_in_flight`: the very same request is still running on the backend.
 * Not an error to show the user and not a reason to burn attempts — the flush simply pauses.
 */
export function isInFlightConflict(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 425 || error.code === "idempotency_in_flight");
}

/** Wait before re-flushing after an in-flight conflict that came without a `Retry-After`. */
export const DEFAULT_RETRY_AFTER_MS = 2000;

/**
 * Splits the queue into consecutive runs that may be sent as one request: neighbouring marks
 * (the only kind `POST /marks/batch` takes) form a group, everything else stays alone.
 *
 * Runs, not "all the marks first": the queue's order is a promise to the user. A check belongs to
 * a mark that may itself still be queued, and comments in a thread are ordered by the `created_at`
 * the backend stamps on arrival. Grouping only *adjacent* marks and sending the groups one after
 * another leaves the global order byte-for-byte what the per-item loop produced.
 */
export function groupForBatch(items: QueuedItem[]): QueuedItem[][] {
    const groups: QueuedItem[][] = [];
    for (const item of items) {
        const last = groups[groups.length - 1];
        if (last && item.payload.kind === "mark" && last[0].payload.kind === "mark") {
            last.push(item);
        } else {
            groups.push([item]);
        }
    }
    return groups;
}

/** Sorted oldest first, only the given user's items. */
export function selectPending(items: QueuedItem[], userId: number): QueuedItem[] {
    return items
        .filter((item) => item.user_id === userId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function markFailed(item: QueuedItem, error: unknown): QueuedItem {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return { ...item, attempts: item.attempts + 1, last_error: message };
}
