import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import NotificationsService from "../services/NotificationsService";
import inbox, { INBOX_PAGE_SIZE, UNREAD_POLL_MS } from "./inbox";
import user from "./user";

/** `document.hidden` is a getter in jsdom: swap it for one we control. */
let hidden = false;

function setHidden(next: boolean): void {
    hidden = next;
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("inbox unread polling", () => {
    let getUnreadCount: ReturnType<typeof vi.spyOn>;
    let addSpy: ReturnType<typeof vi.spyOn>;
    let removeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        hidden = false;
        Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
        user.setUser("tester", 1);
        getUnreadCount = vi.spyOn(NotificationsService, "getUnreadCount")
            .mockResolvedValue({ success: true, payload: { count: 3 } });
        addSpy = vi.spyOn(document, "addEventListener");
        removeSpy = vi.spyOn(document, "removeEventListener");
    });

    afterEach(() => {
        inbox.stopPolling();
        user.resetUser();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("polls on an interval while the tab is visible", () => {
        inbox.startPolling();
        expect(getUnreadCount).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(UNREAD_POLL_MS * 2);
        expect(getUnreadCount).toHaveBeenCalledTimes(3);
    });

    it("stops requesting while the tab is hidden", () => {
        inbox.startPolling();
        getUnreadCount.mockClear();

        setHidden(true);
        vi.advanceTimersByTime(UNREAD_POLL_MS * 5);
        expect(getUnreadCount).not.toHaveBeenCalled();
    });

    it("refetches immediately and resumes the interval when the tab comes back", () => {
        inbox.startPolling();
        setHidden(true);
        vi.advanceTimersByTime(UNREAD_POLL_MS * 5);
        getUnreadCount.mockClear();

        setHidden(false);
        expect(getUnreadCount).toHaveBeenCalledTimes(1); // the counter went stale while away

        vi.advanceTimersByTime(UNREAD_POLL_MS);
        expect(getUnreadCount).toHaveBeenCalledTimes(2);
    });

    it("does not stack timers when the tab is shown twice or polling restarts", () => {
        inbox.startPolling();
        inbox.startPolling();
        setHidden(false);
        getUnreadCount.mockClear();

        vi.advanceTimersByTime(UNREAD_POLL_MS);
        expect(getUnreadCount).toHaveBeenCalledTimes(1);
    });

    it("stopPolling removes the visibility listener and the timer", () => {
        inbox.startPolling();
        const listener = addSpy.mock.calls.find(([type]) => type === "visibilitychange")?.[1];
        expect(listener).toBeDefined();

        inbox.stopPolling();
        expect(removeSpy).toHaveBeenCalledWith("visibilitychange", listener);

        getUnreadCount.mockClear();
        setHidden(true);
        setHidden(false);
        vi.advanceTimersByTime(UNREAD_POLL_MS * 3);
        expect(getUnreadCount).not.toHaveBeenCalled();
    });
});

describe("inbox pagination", () => {
    let getNotifications: MockInstance<typeof NotificationsService.getNotifications>;

    /** A backend holding `total` notifications, answering `limit` of them from `offset`. */
    function page(total: number, limit: number, offset: number) {
        return {
            success: true,
            payload: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({
                id: offset + i,
                type: "mark.status",
                mark_id: null,
                task_id: null,
                title: `n${offset + i}`,
                body: "",
                read_at: null,
                created_at: "2026-01-01T00:00:00Z",
            })),
            meta: { limit, offset, total },
        };
    }

    beforeEach(() => {
        user.setUser("tester", 1);
        inbox.reset();
        vi.spyOn(NotificationsService, "getUnreadCount").mockResolvedValue({ success: true, payload: { count: 0 } });
        getNotifications = vi.spyOn(NotificationsService, "getNotifications")
            .mockImplementation(async (req = {}) => page(120, req.limit ?? INBOX_PAGE_SIZE, req.offset ?? 0));
    });

    afterEach(() => {
        inbox.reset();
        user.resetUser();
        vi.restoreAllMocks();
    });

    it("reads meta.total so the panel knows the first page is not all of it", async () => {
        await inbox.fetch();
        expect(inbox.items).toHaveLength(INBOX_PAGE_SIZE);
        expect(inbox.total).toBe(120);
        expect(inbox.remaining).toBe(120 - INBOX_PAGE_SIZE);
    });

    it("loadMore appends the next page instead of replacing the list", async () => {
        await inbox.fetch();
        await inbox.loadMore();

        expect(getNotifications.mock.calls.map(([req]) => req?.offset))
            .toEqual([0, INBOX_PAGE_SIZE]);
        expect(inbox.items).toHaveLength(INBOX_PAGE_SIZE * 2);
        expect(inbox.items[0].id).toBe(0);
        expect(inbox.items[INBOX_PAGE_SIZE].id).toBe(INBOX_PAGE_SIZE);
        expect(inbox.isLoadingMore).toBe(false);
    });

    it("a second loadMore while the first is in flight is ignored, so no page is doubled", async () => {
        await inbox.fetch();
        const both = Promise.all([inbox.loadMore(), inbox.loadMore()]);
        await both;

        expect(getNotifications).toHaveBeenCalledTimes(2); // the first page and one more
        expect(inbox.items).toHaveLength(INBOX_PAGE_SIZE * 2);
    });

    it("refreshing from the first page replaces what was loaded and there is no button at the end", async () => {
        getNotifications.mockImplementation(async (req = {}) => page(2, req.limit ?? INBOX_PAGE_SIZE, req.offset ?? 0));
        await inbox.fetch();
        expect(inbox.items).toHaveLength(2);
        expect(inbox.remaining).toBe(0);

        await inbox.loadMore();
        expect(getNotifications).toHaveBeenCalledTimes(1); // nothing left to ask for
    });
});
