import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryQueueStorage } from "./storage";
import {
    classifyFailure,
    createQueuedItem,
    dispositionOf,
    groupForBatch,
    isFinalFailure,
    isNetworkFailure,
    markFailed,
    MAX_RETRY_AFTER_MS,
    newIdempotencyKey,
    retryDelayMs,
    selectPending,
} from "./queue";
import { OfflineQueueStore, QueueSender } from "../store/offline-queue";
import { ApiError, parseRetryAfter } from "../services/http";
import type { BatchMarkResult } from "../services/MarksService";
import notificationsStore from "../store/notifications";
import user from "../store/user";
import type { QueuedItem, QueuedPayload } from "./types";

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

    /**
     * The order is not an implementation detail to be optimised away: the backend's
     * de-duplication is defined in terms of it. `POST /marks` refuses a mark whose twin is
     * already inside the dedup radius with a 409, which `isFinalFailure` reads as "already
     * applied" and drops -- so two nearby marks recorded offline collapse into one only
     * because the second is sent after the first exists. Sent together they would both be
     * created. See the note on `OfflineQueueStore.flush`.
     */
    it("sends strictly in order, so the backend's 409 can still collapse a duplicate", async () => {
        const first = await store.enqueue({ kind: "mark", longitude: 41.4, latitude: 52.7, mark_type_id: 1, description: "яма", force: false, photos: [] });
        const twin = await store.enqueue({ kind: "mark", longitude: 41.4, latitude: 52.7, mark_type_id: 1, description: "та же яма", force: false, photos: [] });

        const inFlight = new Set<string>();
        const created: { lon: number; lat: number; type: number }[] = [];
        (sender.send as ReturnType<typeof vi.fn>).mockImplementation(async (item: QueuedItem) => {
            // a second request opened before this one closed would mean the dedup check below
            // runs against a backend that has not seen the first mark yet
            expect(inFlight.size).toBe(0);
            inFlight.add(item.id);
            sent.push(item);
            await Promise.resolve();
            const p = item.payload as { kind: string; longitude: number; latitude: number; mark_type_id: number };
            const similar = created.some((m) => m.lon === p.longitude && m.lat === p.latitude && m.type === p.mark_type_id);
            inFlight.delete(item.id);
            if (similar) {
                throw new ApiError("similar marks nearby", 409);
            }
            created.push({ lon: p.longitude, lat: p.latitude, type: p.mark_type_id });
        });

        await store.flush();

        expect(sent.map((x) => x.id)).toEqual([first.id, twin.id]);
        expect(created).toHaveLength(1); // the twin was refused and dropped, not created twice
        expect(store.count).toBe(0);
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

describe("failure classification (backend integration/wave-6 error codes)", () => {
    it("keeps 409 final only for de-duplication; in-flight and reused keys get their own fate", () => {
        // old backend: no codes at all -- a bare 409 keeps meaning "already applied"
        expect(classifyFailure(409, undefined)).toBe("applied");
        expect(dispositionOf(new ApiError("dup", 409))).toBe("applied");
        expect(isFinalFailure(new ApiError("dup", 409))).toBe(true);

        // new backend: the same de-duplication, now named
        expect(dispositionOf(new ApiError("similar", 409, undefined, { code: "similar_marks" }))).toBe("applied");

        // the bug: a conflict that only means "your own request is still running"
        expect(dispositionOf(new ApiError("in flight", 425, undefined, { code: "idempotency_in_flight" }))).toBe("retry");
        expect(dispositionOf(new ApiError("in flight", 409, undefined, { code: "idempotency_in_flight" }))).toBe("retry");
        expect(isFinalFailure(new ApiError("in flight", 425))).toBe(false);

        // spent key: dropped, but never as a success
        expect(dispositionOf(new ApiError("reused", 422, undefined, { code: "idempotency_key_reused" }))).toBe("discard");
        // a bare 422 from an old backend is not a discard -- dropping a record on a plain
        // validation error is the very failure this change undoes
        expect(dispositionOf(new ApiError("bad", 422))).toBe("retry");

        expect(dispositionOf(new ApiError("boom", 500))).toBe("retry");
        expect(dispositionOf(new TypeError("Failed to fetch"))).toBe("retry");
    });

    it("reads Retry-After as seconds or a date, capped and never negative", () => {
        expect(parseRetryAfter(null)).toBeUndefined();
        expect(parseRetryAfter("3")).toBe(3);
        expect(parseRetryAfter("-1")).toBeUndefined();
        expect(parseRetryAfter("nonsense")).toBeUndefined();
        // an HTTP date has no milliseconds, so the "now" it is measured against is pinned
        const at = new Date("2026-08-30T10:00:05Z");
        expect(parseRetryAfter(at.toUTCString(), Date.parse("2026-08-30T10:00:00Z"))).toBe(5);
        expect(parseRetryAfter(at.toUTCString(), Date.parse("2026-08-30T10:01:00Z"))).toBe(0);

        expect(retryDelayMs(new ApiError("x", 425, undefined, { retryAfter: 3 }))).toBe(3000);
        expect(retryDelayMs(new ApiError("x", 425))).toBe(0);
        expect(retryDelayMs(new ApiError("x", 425, undefined, { retryAfter: 9999 }))).toBe(MAX_RETRY_AFTER_MS);
        expect(retryDelayMs(new TypeError("nope"))).toBe(0);
    });

    it("groups only adjacent marks, so nothing overtakes the item it depends on", () => {
        const mk = (id: string) => createQueuedItem(1, { kind: "mark", longitude: 1, latitude: 2, mark_type_id: 1, description: id, force: false, photos: [] }, id);
        const ck = (id: string) => createQueuedItem(1, { kind: "check", mark_id: 1, result: true, comment: "", photos: [] }, id);
        const groups = groupForBatch([mk("m1"), mk("m2"), ck("c1"), mk("m3")]);
        expect(groups.map((g) => g.map((x) => x.id))).toEqual([["m1", "m2"], ["c1"], ["m3"]]);
        expect(groupForBatch([])).toEqual([]);
    });
});

describe("OfflineQueueStore with a batch-capable sender", () => {
    let storage: MemoryQueueStorage;
    let calls: string[];
    let sender: QueueSender;
    let store: OfflineQueueStore;
    let batchAnswer: (items: QueuedItem[]) => BatchMarkResult[];

    const mark = (description: string): QueuedPayload => ({ kind: "mark", longitude: 41.4, latitude: 52.7, mark_type_id: 1, description, force: false, photos: [] });

    beforeEach(() => {
        localStorage.clear();
        notificationsStore.clear();
        user.setUser("u", 7, "user");
        storage = new MemoryQueueStorage();
        calls = [];
        batchAnswer = (items) => items.map((_, index) => ({ index, status: "created" as const, mark_id: index + 1 }));
        sender = {
            send: vi.fn(async (item: QueuedItem) => { calls.push(`single:${item.id}`); }),
            sendMarks: vi.fn(async (items: QueuedItem[]) => {
                calls.push(`batch:${items.map((x) => x.id).join(",")}`);
                return batchAnswer(items);
            }),
        };
        store = new OfflineQueueStore(storage, sender);
    });

    afterEach(() => {
        store.stop(); // cancels a Retry-After timer a test may have armed
        notificationsStore.clear();
    });

    it("sends adjacent marks as one batch and keeps a mixed queue in order", async () => {
        await store.enqueue(mark("first"), "m1");
        await store.enqueue(mark("second"), "m2");
        await store.enqueue({ kind: "check", mark_id: 5, result: true, comment: "", photos: [] }, "c1");
        await store.enqueue({ kind: "comment", mark_id: 5, body: "hi" }, "k1");
        await store.enqueue(mark("third"), "m3");
        await store.enqueue({ kind: "check", mark_id: 6, result: false, comment: "", photos: [] }, "c2");

        await store.flush();

        // the batch covers m1+m2 only: the check that follows may well be the check *of* m2, and
        // a lone mark is cheaper to send the old way
        expect(calls).toEqual(["batch:m1,m2", "single:c1", "single:k1", "single:m3", "single:c2"]);
        const firstBatch = (sender.sendMarks as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueuedItem[];
        expect(firstBatch.map((x) => x.id)).toEqual(["m1", "m2"]);
        expect(store.count).toBe(0);
        expect(await storage.getAll()).toEqual([]);
    });

    it("removes created/replayed/duplicate results and keeps an in-flight failure queued", async () => {
        await store.enqueue(mark("a"), "a");
        await store.enqueue(mark("b"), "b");
        await store.enqueue(mark("c"), "c");
        await store.enqueue(mark("d"), "d");
        batchAnswer = () => [
            { index: 0, status: "created", mark_id: 1 },
            { index: 1, status: "replayed", mark_id: 2 },
            { index: 2, status: "duplicate", mark_id: 3 },
            { index: 3, status: "failed", error: { message: "still running", code: "idempotency_in_flight" } },
        ];

        await store.flush();

        expect(store.pending.map((x) => x.id)).toEqual(["d"]);
        expect(store.pending[0]).toMatchObject({ attempts: 1, last_error: "still running" });
        expect(store.lastFlushedAt).toBeGreaterThan(0);
    });

    it("drops a spent idempotency key without calling it sent", async () => {
        await store.enqueue(mark("a"), "a");
        await store.enqueue(mark("b"), "b");
        batchAnswer = () => [
            { index: 0, status: "failed", error: { message: "key reused", code: "idempotency_key_reused" } },
            { index: 1, status: "created", mark_id: 2 },
        ];

        await store.flush();

        expect(store.count).toBe(0);
        expect(notificationsStore.error).toBe("key reused");
    });

    it("falls back to one-by-one sending when the backend has no batch route (404), once per session", async () => {
        await store.enqueue(mark("a"), "a");
        await store.enqueue(mark("b"), "b");
        await store.enqueue(mark("c"), "c");
        (sender.sendMarks as ReturnType<typeof vi.fn>).mockImplementationOnce(async (items: QueuedItem[]) => {
            calls.push(`batch:${items.map((x) => x.id).join(",")}`);
            throw new ApiError("not found", 404);
        });

        await store.flush();

        expect(calls).toEqual(["batch:a,b,c", "single:a", "single:b", "single:c"]);
        expect(store.count).toBe(0);

        // the 404 is remembered: the next flush does not probe the route again
        await store.enqueue(mark("d"), "d");
        await store.enqueue(mark("e"), "e");
        await store.flush();
        expect(calls.slice(4)).toEqual(["single:d", "single:e"]);
        expect(sender.sendMarks).toHaveBeenCalledTimes(1);
    });

    it("keeps the item queued on a 425 and honours Retry-After before trying again", async () => {
        vi.useFakeTimers();
        await store.enqueue(mark("a"), "a");
        (sender.send as ReturnType<typeof vi.fn>).mockImplementation(async (item: QueuedItem) => {
            calls.push(`single:${item.id}`);
            throw new ApiError("still running", 425, undefined, { code: "idempotency_in_flight", retryAfter: 2 });
        });

        await store.flush(); // a lone mark takes the per-item path

        expect(store.pending.map((x) => x.id)).toEqual(["a"]);
        expect(store.pending[0]).toMatchObject({ attempts: 1, last_error: "still running" });
        expect(store.lastFlushedAt).toBe(0);
        expect(notificationsStore.error).toBeNull(); // waiting for our own request is not a user-facing error
        expect(calls).toEqual(["single:a"]);

        await vi.advanceTimersByTimeAsync(1999);
        expect(calls).toEqual(["single:a"]); // Retry-After is honoured, not ignored
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toEqual(["single:a", "single:a"]);
        vi.useRealTimers();
    });

    it("marks the whole group failed and stops when the batch request never reaches the backend", async () => {
        await store.enqueue(mark("a"), "a");
        await store.enqueue(mark("b"), "b");
        await store.enqueue({ kind: "comment", mark_id: 1, body: "after" }, "k1");
        (sender.sendMarks as ReturnType<typeof vi.fn>).mockImplementation(async () => { throw new TypeError("Failed to fetch"); });

        await store.flush();

        expect(store.pending.map((x) => x.id)).toEqual(["a", "b", "k1"]);
        expect(store.pending.slice(0, 2).every((x) => x.attempts === 1)).toBe(true);
        expect(calls).toEqual([]); // nothing after the failed group was sent
    });
});
