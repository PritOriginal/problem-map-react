import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import { createQueueStorage } from "../offline/storage";
import { createQueuedItem, fromQueuedPhotos, isFinalFailure, isNetworkFailure, markFailed, selectPending } from "../offline/queue";
import type { QueuedItem, QueuedPayload, QueueStorage } from "../offline/types";
import MarksService from "../services/MarksService";
import ChecksService from "../services/ChecksService";
import CommentsService from "../services/CommentsService";
import notificationsStore from "./notifications";
import user from "./user";

export interface QueueSender {
    send(item: QueuedItem): Promise<unknown>;
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

    constructor(storage: QueueStorage = createQueueStorage(), sender: QueueSender = apiSender) {
        this.storage = storage;
        this.sender = sender;
        makeAutoObservable<OfflineQueueStore, "storage" | "sender" | "onlineListener">(this, { storage: false, sender: false, onlineListener: false });
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
     * Sends pending items one by one; stops at the first network failure.
     *
     * The sequence is deliberate, and it is not a `Promise.all` waiting to happen -- the
     * backend's own de-duplication is defined in terms of send order:
     *
     * - `POST /marks` answers 409 "similar marks nearby" when an active mark of the same type
     *   already sits inside the dedup radius. Two nearby marks recorded offline are exactly
     *   the case that produces: sent one after the other, the first is created and the second
     *   is refused and dropped here (`isFinalFailure`); sent together, neither exists yet when
     *   the other is checked, and the user ends up with the duplicate the backend was there
     *   to prevent.
     * - The same 409 is also what the backend answers while a request with the same
     *   `Idempotency-Key` is still in progress. Every 409 is read here as "already applied,
     *   drop it", so overlapping sends are precisely where a spurious conflict would silently
     *   delete a queued item instead of retrying it.
     * - Comments in a thread are ordered by the `created_at` the backend stamps on arrival.
     *   Racing them reorders what the author wrote in order.
     * - "Stop at the first network failure" cannot be honoured by requests already in flight:
     *   coming back online on a flaky connection would fire the whole queue at a network about
     *   to drop again, and burn an attempt on every item.
     *
     * The prize is smaller than it looks, too: the wall time of a queue of photo uploads is
     * its bytes over the uplink that has only just come back, and issuing them at once merely
     * makes them share that uplink. What would be worth having is a batch endpoint, not
     * overlapped singles.
     */
    flush = async (): Promise<void> => {
        if (this.isFlushing || user.id === 0) {
            return;
        }
        const pending = this.pending;
        if (pending.length === 0) {
            return;
        }
        this.isFlushing = true;
        let sent = 0;
        try {
            for (const item of pending) {
                if (item.user_id !== user.id) {
                    break; // signed out / switched user mid-flush: the rest belongs to someone else
                }
                try {
                    await this.sender.send(item);
                    await this.remove(item.id);
                    sent++;
                } catch (error) {
                    console.error("Offline queue: send failed", error);
                    if (isFinalFailure(error)) {
                        await this.remove(item.id);
                        sent++;
                        continue;
                    }
                    const failed = markFailed(item, error);
                    await this.storage.put(failed);
                    runInAction(() => {
                        this.items = this.items.map((x) => (x.id === failed.id ? failed : x));
                    });
                    if (isNetworkFailure(error)) {
                        break;
                    }
                    notificationsStore.showError(error, t("offline.sendFailed"));
                }
            }
        } finally {
            runInAction(() => {
                this.isFlushing = false;
                if (sent > 0) {
                    this.lastFlushedAt = Date.now();
                }
            });
        }
    }
}

const offlineQueueStore = new OfflineQueueStore();

export default offlineQueueStore;
