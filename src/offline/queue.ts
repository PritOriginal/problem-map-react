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
 * Whether a failed send should keep the item in the queue. A 2xx removes it, a network failure keeps
 * it; a backend error keeps it too unless it is a conflict that means the request was already
 * applied (409 on an idempotent retry, 401 sign-out is not final either).
 */
export function isFinalFailure(error: unknown): boolean {
    return error instanceof ApiError && error.status === 409;
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
