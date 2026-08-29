import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsService from "../services/NotificationsService";
import inbox, { UNREAD_POLL_MS } from "./inbox";
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
