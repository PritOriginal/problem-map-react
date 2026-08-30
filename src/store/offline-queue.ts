import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import { createQueueStorage } from "../offline/storage";
import {
    createQueuedItem,
    DEFAULT_RETRY_AFTER_MS,
    dispositionOf,
    fromQueuedPhotos,
    groupForBatch,
    isInFlightConflict,
    isNetworkFailure,
    markFailed,
    retryDelayMs,
    selectPending,
} from "../offline/queue";
import type { QueuedItem, QueuedPayload, QueueStorage } from "../offline/types";
import MarksService from "../services/MarksService";
import type { BatchMarkResult } from "../services/MarksService";
import ChecksService from "../services/ChecksService";
import CommentsService from "../services/CommentsService";
import { ApiError } from "../services/http";
import notificationsStore from "./notifications";
import user from "./user";

export interface QueueSender {
    send(item: QueuedItem): Promise<unknown>;
    /**
     * Optional: sends several queued **marks** in one `POST /marks/batch`, which the backend
     * applies in the given order. A sender without it — and a backend that answers 404 — falls
     * back to `send`, one item at a time.
     */
    sendMarks?(items: QueuedItem[]): Promise<BatchMarkResult[]>;
}

/** Sends a queued item with its id as `Idempotency-Key`. */
export const apiSender: QueueSender = {
    send(item) {
        const p = item.payload;
        switch (p.kind) {
            case "mark":
                return MarksService.addMark(
                    { point: { longitude: p.longitude, latitude: p.latitude }, mark_type_id: p.mark_type_id, description: p.description },
                    fromQueuedPhotos(p.photos),
                    p.force,
                    item.id,
                );
            case "check":
                return ChecksService.addCheck({ mark_id: p.mark_id, result: p.result, comment: p.comment }, fromQueuedPhotos(p.photos), item.id);
            case "comment":
                return CommentsService.addComment(p.mark_id, { body: p.body, parent_id: p.parent_id }, item.id);
        }
    },
};

/**
 * Offline queue of `POST /marks`, `POST /checks` and `POST /marks/{id}/comments` (backend
 * integration/wave-5): persisted in IndexedDB, flushed sequentially when the browser comes back
 * online or on demand. Items are removed on 2xx and kept (with the error) otherwise; a retry
 * reuses the same `Idempotency-Key`.
 */
export class OfflineQueueStore {
    items: QueuedItem[] = [];
    isFlushing: boolean = false;
    loaded: boolean = false;
    /** Set when a flush succeeded at least one item; consumers may reload their data. */
    lastFlushedAt: number = 0;

    private readonly storage: QueueStorage;
    private readonly sender: QueueSender;
    private onlineListener: (() => void) | null = null;
    /**
     * Set once `POST /marks/batch` answers 404 — the backend in front of us predates wave-6.
     * Remembered for the session so every later flush goes straight to the per-item path instead
     * of paying for a 404 first; a page reload re-probes, which is when a deploy would be picked up.
     */
    private batchUnsupported: boolean = false;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    /** Items disposed of as applied during the running flush (drives `lastFlushedAt`). */
    private flushSent: number = 0;

    constructor(storage: QueueStorage = createQueueStorage(), sender: QueueSender = apiSender) {
        this.storage = storage;
        this.sender = sender;
        makeAutoObservable<OfflineQueueStore, "storage" | "sender" | "onlineListener" | "batchUnsupported" | "retryTimer" | "flushSent">(this, {
            storage: false,
            sender: false,
            onlineListener: false,
            batchUnsupported: false,
            retryTimer: false,
            flushSent: false,
        });
    }

    /** Items of the signed-in user, oldest first. */
    get pending(): QueuedItem[] {
        return selectPending(this.items, user.id);
    }

    get count(): number {
        return this.pending.length;
    }

    load = async () => {
        try {
            const items = await this.storage.getAll();
            runInAction(() => {
                this.items = items;
                this.loaded = true;
            });
        } catch (error) {
            console.error("Offline queue: failed to load", error);
            runInAction(() => {
                this.loaded = true;
            });
        }
    }

    /** Starts flushing on `online`; idempotent. */
    start = () => {
        if (this.onlineListener || typeof window === "undefined") {
            return;
        }
        this.onlineListener = () => {
            this.flush();
        };
        window.addEventListener("online", this.onlineListener);
        this.load().then(() => {
            if (navigator.onLine) {
                this.flush();
            }
        });
    }

    stop = () => {
        if (this.onlineListener) {
            window.removeEventListener("online", this.onlineListener);
            this.onlineListener = null;
        }
        this.cancelRetry();
    }

    enqueue = async (payload: QueuedPayload, id?: string): Promise<QueuedItem> => {
        const item = createQueuedItem(user.id, payload, id);
        await this.storage.put(item);
        runInAction(() => {
            this.items = [...this.items.filter((x) => x.id !== item.id), item];
        });
        return item;
    }

    remove = async (id: string) => {
        await this.storage.delete(id);
        runInAction(() => {
            this.items = this.items.filter((x) => x.id !== id);
        });
    }

    /**
     * Tries the request once; on a network failure the item is queued instead and `queued: true`
     * is returned. Backend errors are rethrown.
     */
    sendOrEnqueue = async <T>(payload: QueuedPayload, send: (idempotencyKey: string) => Promise<T>): Promise<{ queued: true } | { queued: false; result: T }> => {
        const key = createQueuedItem(user.id, payload).id;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            await this.enqueue(payload, key);
            return { queued: true };
        }
        try {
            return { queued: false, result: await send(key) };
        } catch (error) {
            if (isNetworkFailure(error)) {
                await this.enqueue(payload, key);
                return { queued: true };
            }
            throw error;
        }
    }

    /**
     * Sends the pending items, in order, stopping at the first network failure.
     *
     * Adjacent marks go out together through `POST /marks/batch`; everything else, and any
     * backend without that route, goes one request at a time. Either way nothing overtakes
     * anything: the batch is applied server-side in the order it was listed, and the groups are
     * sent one after another. The sequence is not a `Promise.all` waiting to happen — the
     * backend's own de-duplication is defined in terms of order:
     *
     * - `POST /marks` answers 409 `similar_marks` when an active mark of the same type already
     *   sits inside the dedup radius. Two nearby marks recorded offline are exactly that case:
     *   sent one after the other, the first is created and the second is refused and dropped
     *   here; sent concurrently, neither exists yet when the other is checked, and the user ends
     *   up with the duplicate the backend was there to prevent. A batch keeps the collapse *and*
     *   the single round trip, because the server does the sequencing itself.
     * - A check belongs to a mark that may still be in the queue, and comments in a thread are
     *   ordered by the `created_at` the backend stamps on arrival. Racing them reorders what the
     *   author wrote in order — hence groups of *adjacent* marks only (`groupForBatch`), never
     *   "all the marks first".
     * - Until wave-6, the same 409 was also the answer while a request with the same
     *   `Idempotency-Key` was still running, and reading every 409 as "already applied, drop it"
     *   is what silently deleted queued items. That case now arrives as 425 /
     *   `idempotency_in_flight` and pauses the flush instead (`classifyFailure`).
     * - "Stop at the first network failure" cannot be honoured by requests already in flight:
     *   coming back online on a flaky connection would fire the whole queue at a network about
     *   to drop again, and burn an attempt on every item.
     */
    flush = async (): Promise<void> => {
        if (this.isFlushing || user.id === 0) {
            return;
        }
        const pending = this.pending;
        if (pending.length === 0) {
            return;
        }
        this.cancelRetry();
        this.isFlushing = true;
        this.flushSent = 0;
        try {
            for (const group of groupForBatch(pending)) {
                if (group.some((item) => item.user_id !== user.id)) {
                    break; // signed out / switched user mid-flush: the rest belongs to someone else
                }
                const batched = await this.sendGroupBatched(group);
                if (batched === "stop") {
                    break;
                }
                if (batched === "done") {
                    continue;
                }
                if (await this.sendGroupOneByOne(group)) {
                    break;
                }
            }
        } finally {
            const sent = this.flushSent;
            runInAction(() => {
                this.isFlushing = false;
                if (sent > 0) {
                    this.lastFlushedAt = Date.now();
                }
            });
        }
    }

    /**
     * One `POST /marks/batch` for a run of queued marks. `"fallback"` asks the caller to send the
     * group the old way — no batch route on this backend (404, remembered for the session), a
     * group not worth batching, or a batch-level rejection (`invalid_items`, `too_many_items`,
     * 413) whose offending element is only identifiable one request at a time.
     */
    private sendGroupBatched = async (group: QueuedItem[]): Promise<"done" | "stop" | "fallback"> => {
        const sendMarks = this.sender.sendMarks;
        // a single mark gains nothing from the multipart envelope, and the per-item path already
        // reports its outcome precisely
        if (!sendMarks || this.batchUnsupported || group.length < 2 || group[0].payload.kind !== "mark") {
            return "fallback";
        }
        let results: BatchMarkResult[];
        try {
            results = await sendMarks.call(this.sender, group);
        } catch (error) {
            console.error("Offline queue: batch send failed", error);
            if (isNetworkFailure(error)) {
                // the request carried every item in the group, so every one of them failed
                for (const item of group) {
                    await this.recordFailure(item, error);
                }
                return "stop";
            }
            if (error instanceof ApiError && error.status === 404) {
                this.batchUnsupported = true;
            }
            return "fallback";
        }
        for (const result of results) {
            const item = group[result.index];
            if (!item) {
                continue;
            }
            if (result.status === "created" || result.status === "replayed" || result.status === "duplicate") {
                // `duplicate` is the batch's word for the 409 the per-item path collapses
                await this.applied(item);
                continue;
            }
            const error = new ApiError(
                result.error?.message || t("offline.sendFailed"),
                0,
                result.similar_marks ? { similar_marks: result.similar_marks } : undefined,
                { code: result.error?.code },
            );
            if (await this.handleFailure(item, error)) {
                return "stop";
            }
        }
        return "done";
    }

    /** The original path: one request per item, in order. Resolves `true` when the flush must stop. */
    private sendGroupOneByOne = async (group: QueuedItem[]): Promise<boolean> => {
        for (const item of group) {
            try {
                await this.sender.send(item);
                await this.applied(item);
            } catch (error) {
                console.error("Offline queue: send failed", error);
                if (await this.handleFailure(item, error)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Removes an item the backend has (created, replayed or de-duplicated) and counts it as sent. */
    private applied = async (item: QueuedItem): Promise<void> => {
        await this.remove(item.id);
        this.flushSent++;
    }

    /**
     * Disposes of a failed item and says whether the flush should stop. Kept items are stored with
     * the error and an incremented attempt count, exactly as before.
     */
    private handleFailure = async (item: QueuedItem, error: unknown): Promise<boolean> => {
        switch (dispositionOf(error)) {
            case "applied":
                await this.applied(item);
                return false;
            case "discard":
                // the key is spent on different data: replaying it can only fail again. The item
                // leaves the queue, but it was never applied — so it is not counted as sent, and
                // the user is told rather than left thinking it went through.
                await this.remove(item.id);
                notificationsStore.showError(error, t("offline.keyReused"));
                return false;
        }
        await this.recordFailure(item, error);
        if (isNetworkFailure(error)) {
            return true;
        }
        if (isInFlightConflict(error)) {
            // the identical request is still running: wait out `Retry-After` instead of hammering,
            // and hold the rest of the queue back so nothing overtakes this item
            this.scheduleRetry(retryDelayMs(error) || DEFAULT_RETRY_AFTER_MS);
            return true;
        }
        notificationsStore.showError(error, t("offline.sendFailed"));
        return false;
    }

    /** Keeps the item in the queue, remembering the error and the attempt. */
    private recordFailure = async (item: QueuedItem, error: unknown): Promise<void> => {
        const failed = markFailed(item, error);
        await this.storage.put(failed);
        runInAction(() => {
            this.items = this.items.map((x) => (x.id === failed.id ? failed : x));
        });
    }

    private scheduleRetry = (delay: number): void => {
        if (typeof setTimeout === "undefined") {
            return;
        }
        this.cancelRetry();
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.flush();
        }, delay);
    }

    private cancelRetry = (): void => {
        if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }
}

const offlineQueueStore = new OfflineQueueStore();

export default offlineQueueStore;
