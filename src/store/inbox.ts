import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import NotificationsService, { Notification } from "../services/NotificationsService";
import notificationsStore from "./notifications";
import user from "./user";

/** Poll interval for the unread counter while the user is signed in. */
export const UNREAD_POLL_MS = 60_000;

/** One page of the inbox. The backend caps `limit` at 500 and defaults to 100. */
export const INBOX_PAGE_SIZE = 50;

/** User notifications (bell in the header, `/notifications` panel). */
class InboxStore {
    items: Notification[] = [];
    unreadCount: number = 0;
    isLoading: boolean = false;
    /** A further page is on its way; `items` keeps what is on screen. */
    isLoadingMore: boolean = false;
    /** `meta.total` of the last page: how many notifications the backend holds in all. */
    total: number = 0;

    private pollTimer: number | null = null;
    private visibilityListener: (() => void) | null = null;

    constructor() {
        makeAutoObservable<InboxStore, "pollTimer" | "visibilityListener">(this, {
            pollTimer: false,
            visibilityListener: false,
        });
    }

    fetchUnreadCount = async () => {
        if (user.id === 0) {
            return;
        }
        try {
            const response = await NotificationsService.getUnreadCount();
            if (user.id === 0) {
                return; // signed out while the request was in flight
            }
            runInAction(() => {
                this.unreadCount = response.payload?.count ?? 0;
            });
        } catch (error) {
            // the counter is auxiliary: do not spam the banner on each poll
            console.error(error);
        }
    }

    /**
     * Reads one page. `offset > 0` appends (that is what `loadMore` does) instead of
     * replacing, so "show more" grows the list rather than swapping it; the first page
     * always replaces, which is what the refresh button wants.
     */
    fetch = async (limit: number = INBOX_PAGE_SIZE, offset: number = 0) => {
        if (user.id === 0) {
            return;
        }
        const more = offset > 0;
        runInAction(() => {
            this.isLoading = !more;
            this.isLoadingMore = more;
        });
        try {
            const response = await NotificationsService.getNotifications({ limit, offset });
            if (user.id === 0) {
                return; // signed out while the request was in flight (state was reset by stopPolling)
            }
            runInAction(() => {
                const page = Array.isArray(response.payload) ? response.payload : [];
                this.items = more ? [...this.items, ...page] : page;
                // No `meta` from an older backend: assume what arrived is all there is,
                // so the button simply never appears.
                this.total = response.meta?.total ?? this.items.length;
                this.isLoading = false;
                this.isLoadingMore = false;
            });
            // the list is paginated: the badge is authoritative from the counter endpoint
            this.fetchUnreadCount();
        } catch (error) {
            if (user.id === 0) {
                return;
            }
            console.error(error);
            runInAction(() => {
                notificationsStore.showError(error, t("notifications.loadFailed"));
                this.isLoading = false;
                this.isLoadingMore = false;
            });
        }
    }

    /** How many the backend still has beyond what was read. */
    get remaining(): number {
        return Math.max(0, this.total - this.items.length);
    }

    /**
     * Next page. Ignored while a request is already in flight, so a fast double press
     * cannot ask for the same offset twice and duplicate a page.
     */
    loadMore = async () => {
        if (this.isLoading || this.isLoadingMore || this.remaining === 0) {
            return;
        }
        await this.fetch(INBOX_PAGE_SIZE, this.items.length);
    }

    markRead = async (id: number) => {
        const item = this.items.find((n) => n.id === id);
        if (!item || item.read_at !== null) {
            return;
        }
        try {
            await NotificationsService.markRead(id);
            runInAction(() => {
                item.read_at = new Date().toISOString();
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            });
        } catch (error) {
            console.error(error);
            notificationsStore.showError(error, t("notifications.markReadFailed"));
        }
    }

    markAllRead = async () => {
        try {
            await NotificationsService.markAllRead();
            runInAction(() => {
                const now = new Date().toISOString();
                this.items.forEach((n) => {
                    if (n.read_at === null) {
                        n.read_at = now;
                    }
                });
                this.unreadCount = 0;
            });
        } catch (error) {
            console.error(error);
            notificationsStore.showError(error, t("notifications.markAllReadFailed"));
        }
    }

    /**
     * Starts polling the unread counter; idempotent. The timer only runs while the tab is
     * visible: a backgrounded tab keeps neither the interval nor the traffic, and coming
     * back refetches at once, since the counter is stale after any time away.
     */
    startPolling = () => {
        if (this.visibilityListener !== null) {
            return;
        }
        this.visibilityListener = () => {
            if (document.hidden) {
                this.clearTimer();
            } else if (this.pollTimer === null) {
                this.fetchUnreadCount();
                this.pollTimer = window.setInterval(this.fetchUnreadCount, UNREAD_POLL_MS);
            }
        };
        document.addEventListener("visibilitychange", this.visibilityListener);
        if (!document.hidden) {
            this.fetchUnreadCount();
            this.pollTimer = window.setInterval(this.fetchUnreadCount, UNREAD_POLL_MS);
        }
    }

    /** Stops polling and clears the inbox (called when the bell unmounts, i.e. on sign-out). */
    stopPolling = () => {
        this.clearTimer();
        if (this.visibilityListener !== null) {
            document.removeEventListener("visibilitychange", this.visibilityListener);
            this.visibilityListener = null;
        }
        this.reset();
    }

    private clearTimer = () => {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    reset = () => {
        this.items = [];
        this.unreadCount = 0;
        this.total = 0;
        this.isLoading = false;
        this.isLoadingMore = false;
    }
}

const inboxStore = new InboxStore();

export default inboxStore;
