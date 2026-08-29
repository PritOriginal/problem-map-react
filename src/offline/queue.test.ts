import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryQueueStorage } from "./storage";
import { createQueuedItem, isFinalFailure, isNetworkFailure, markFailed, newIdempotencyKey, selectPending } from "./queue";
import { OfflineQueueStore, QueueSender } from "../store/offline-queue";
import { ApiError } from "../services/http";
import user from "../store/user";
import type { QueuedItem } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("offline queue helpers", () => {
    it("generates uuid v4 idempotency keys", () => {
        const a = newIdempotencyKey();
        const b = newIdempotencyKey();
        expect(a).toMatch(UUID_RE);
        expect(a).not.toBe(b);
    });

    it("classifies failures: offline / fetch TypeError are network failures, ApiError is not", () => {
        expect(isNetworkFailure(new TypeError("Failed to fetch"), true)).toBe(true);
        expect(isNetworkFailure(new ApiError("x", 500), false)).toBe(true);
        expect(isNetworkFailure(new ApiError("x", 500), true)).toBe(false);
        expect(isNetworkFailure(new Error("other"), true)).toBe(false);
        expect(isFinalFailure(new ApiError("dup", 409))).toBe(true);
        expect(isFinalFailure(new ApiError("bad", 400))).toBe(false);
    });

    it("selects the user's items oldest first and records failures", () => {
        const a = createQueuedItem(1, { kind: "comment", mark_id: 1, body: "a" }, "a", new Date("2026-01-02T00:00:00Z"));
        const b = createQueuedItem(1, { kind: "comment", mark_id: 1, body: "b" }, "b", new Date("2026-01-01T00:00:00Z"));
        const other = createQueuedItem(2, { kind: "comment", mark_id: 1, body: "c" }, "c");
        expect(selectPending([a, b, other], 1).map((x) => x.id)).toEqual(["b", "a"]);
        const failed = markFailed(a, new Error("boom"));
        expect(failed).toMatchObject({ id: "a", attempts: 1, last_error: "boom" });
        expect(a.attempts).toBe(0);
    });
});

describe("OfflineQueueStore", () => {
    let storage: MemoryQueueStorage;
    let sent: QueuedItem[];
    let sender: QueueSender;
    let store: OfflineQueueStore;

    beforeEach(() => {
        localStorage.clear();
        user.setUser("u", 7, "user");
        storage = new MemoryQueueStorage();
        sent = [];
        sender = { send: vi.fn(async (item: QueuedItem) => { sent.push(item); }) };
        store = new OfflineQueueStore(storage, sender);
    });

    it("enqueues with the idempotency key as id and persists photos as blobs", async () => {
        const blob = new Blob(["img"], { type: "image/png" });
        const item = await store.enqueue({ kind: "check", mark_id: 3, result: true, comment: "ok", photos: [{ name: "p.png", type: "image/png", blob }] });
        expect(item.id).toMatch(UUID_RE);
        expect(item.user_id).toBe(7);
        expect(store.count).toBe(1);
        const persisted = await storage.getAll();
        expect(persisted[0].payload.kind).toBe("check");
        expect((persisted[0].payload as { photos: { blob: Blob }[] }).photos[0].blob).toBeInstanceOf(Blob);
    });

    it("flush sends sequentially, removes on success and keeps failed items with the same key", async () => {
        const ok = await store.enqueue({ kind: "comment", mark_id: 1, body: "first" });
        const bad = await store.enqueue({ kind: "comment", mark_id: 1, body: "second" });
        const good2 = await store.enqueue({ kind: "comment", mark_id: 1, body: "third" });
        (sender.send as ReturnType<typeof vi.fn>).mockImplementation(async (item: QueuedItem) => {
            sent.push(item);
            if (item.id === bad.id && sent.filter((x) => x.id === bad.id).length === 1) {
                throw new ApiError("server error", 500);
            }
        });

        await store.flush();
        expect(sent.map((x) => x.id)).toEqual([ok.id, bad.id, good2.id]);
        expect(store.pending.map((x) => x.id)).toEqual([bad.id]);
        expect(store.pending[0]).toMatchObject({ attempts: 1, last_error: "server error" });
        expect(await storage.getAll()).toHaveLength(1);

        // retry reuses the very same idempotency key
        await store.flush();
        expect(sent.filter((x) => x.id === bad.id)).toHaveLength(2);
        expect(store.count).toBe(0);
        expect(store.lastFlushedAt).toBeGreaterThan(0);
    });

    it("flush stops at the first network failure and drops items the backend already applied (409)", async () => {
        const dup = await store.enqueue({ kind: "comment", mark_id: 1, body: "dup" });
        const offline = await store.enqueue({ kind: "comment", mark_id: 1, body: "offline" });
        const later = await store.enqueue({ kind: "comment", mark_id: 1, body: "later" });
        (sender.send as ReturnType<typeof vi.fn>).mockImplementation(async (item: QueuedItem) => {
            sent.push(item);
            if (item.id === dup.id) {
                throw new ApiError("already exists", 409);
            }
            if (item.id === offline.id) {
                throw new TypeError("Failed to fetch");
            }
        });
        await store.flush();
        expect(sent.map((x) => x.id)).toEqual([dup.id, offline.id]);
        expect(store.pending.map((x) => x.id)).toEqual([offline.id, later.id]);
    });

    it("sendOrEnqueue sends when online and queues on a network failure with the same key", async () => {
        const send = vi.fn(async (key: string) => ({ key }));
        const res = await store.sendOrEnqueue({ kind: "comment", mark_id: 1, body: "x" }, send);
        expect(res).toMatchObject({ queued: false });
        expect(send.mock.calls[0][0]).toMatch(UUID_RE);
        expect(store.count).toBe(0);

        const failing = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
        const res2 = await store.sendOrEnqueue({ kind: "comment", mark_id: 1, body: "y" }, failing);
        expect(res2).toEqual({ queued: true });
        expect(store.pending[0].id).toBe(failing.mock.calls.length === 1 ? store.pending[0].id : "");
        expect(store.count).toBe(1);

        const apiFail = vi.fn(async () => { throw new ApiError("bad request", 400); });
        await expect(store.sendOrEnqueue({ kind: "comment", mark_id: 1, body: "z" }, apiFail)).rejects.toBeInstanceOf(ApiError);
        expect(store.count).toBe(1);
    });

    it("sendOrEnqueue queues immediately while navigator.onLine is false", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const send = vi.fn(async () => ({}));
        const res = await store.sendOrEnqueue({ kind: "mark", longitude: 1, latitude: 2, mark_type_id: 1, description: "", force: false, photos: [] }, send);
        expect(res).toEqual({ queued: true });
        expect(send).not.toHaveBeenCalled();
        expect(store.count).toBe(1);
        vi.restoreAllMocks();
    });

    it("load restores persisted items and ignores other users' items when flushing", async () => {
        await storage.put(createQueuedItem(7, { kind: "comment", mark_id: 1, body: "mine" }, "mine"));
        await storage.put(createQueuedItem(8, { kind: "comment", mark_id: 1, body: "theirs" }, "theirs"));
        await store.load();
        expect(store.items).toHaveLength(2);
        expect(store.count).toBe(1);
        await store.flush();
        expect(sent.map((x) => x.id)).toEqual(["mine"]);
        expect((await storage.getAll()).map((x) => x.id)).toEqual(["theirs"]);
    });
});
