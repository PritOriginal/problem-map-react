/** A photo kept in the queue: the bytes plus the original name/type to rebuild a `File`. */
export interface QueuedPhoto {
    name: string;
    type: string;
    blob: Blob;
}

export type QueuedPayload =
    | { kind: "mark"; longitude: number; latitude: number; mark_type_id: number; description: string; force: boolean; photos: QueuedPhoto[] }
    | { kind: "check"; mark_id: number; result: boolean; comment: string; photos: QueuedPhoto[] }
    | { kind: "comment"; mark_id: number; body: string; parent_id?: number };

export type QueuedKind = QueuedPayload["kind"];

export interface QueuedItem {
    /** Also the `Idempotency-Key`: a retry reuses it, so the backend applies the request once. */
    id: string;
    /** User the item belongs to; items of other users are never sent. */
    user_id: number;
    created_at: string;
    attempts: number;
    /** Message of the last failed attempt, for the queue list. */
    last_error: string | null;
    payload: QueuedPayload;
}

/** Persistence of the offline queue (IndexedDB in the app, in-memory in tests). */
export interface QueueStorage {
    getAll(): Promise<QueuedItem[]>;
    put(item: QueuedItem): Promise<void>;
    delete(id: string): Promise<void>;
}
