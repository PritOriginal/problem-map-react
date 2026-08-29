import { makeAutoObservable, runInAction } from "mobx";
import { t } from "../i18n";
import NotificationsService, { Notification } from "../services/NotificationsService";
import notificationsStore from "./notifications";
import user from "./user";

/** Poll interval for the unread counter while the user is signed in. */
export const UNREAD_POLL_MS = 60_000;

/** User notifications (bell in the header, `/notifications` panel). */
class InboxStore {
    items: Notification[] = [];
    unreadCount: number = 0;
    isLoading: boolean = false;

    private pollTimer: number | null = null;

    constructor() {
        makeAutoObservable<InboxStore, "pollTimer">(this, { pollTimer: false });
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

    fetch = async (limit: number = 50, offset: number = 0) => {
        if (user.id === 0) {
            return;
        }
        this.isLoading = true;
        try {
            const response = await NotificationsService.getNotifications({ limit, offset });
            if (user.id === 0) {
                return; // signed out while the request was in flight (state was reset by stopPolling)
            }
            runInAction(() => {
                this.items = Array.isArray(response.payload) ? response.payload : [];
                this.isLoading = false;
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
            });
        }
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

    /** Starts polling the unread counter; idempotent. */
    startPolling = () => {
        if (this.pollTimer !== null) {
            return;
        }
        this.fetchUnreadCount();
        this.pollTimer = window.setInterval(this.fetchUnreadCount, UNREAD_POLL_MS);
    }

    /** Stops polling and clears the inbox (called when the bell unmounts, i.e. on sign-out). */
    stopPolling = () => {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.reset();
    }

    reset = () => {
        this.items = [];
        this.unreadCount = 0;
        this.isLoading = false;
    }
}

const inboxStore = new InboxStore();

export default inboxStore;
