import { makeAutoObservable, runInAction } from "mobx";
import NotificationsService, { Notification } from "../services/NotificationsService";
import notificationsStore from "./notifications";
import user from "./user";

/** Poll interval for the unread counter while the user is signed in. */
export const UNREAD_POLL_MS = 60_000;

/** User notifications (bell in the header, `/notifications` panel). */
class InboxStore {
    items: Notification[] = [];
    total: number = 0;
    unreadCount: number = 0;
    isLoading: boolean = false;
    error: string | null = null;

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
            runInAction(() => {
                this.unreadCount = response.payload.count;
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
        this.error = null;
        try {
            const response = await NotificationsService.getNotifications({ limit, offset });
            runInAction(() => {
                this.items = response.payload ?? [];
                this.total = response.meta?.total ?? this.items.length;
                this.isLoading = false;
            });
            // the list is paginated: the badge is authoritative from the counter endpoint
            this.fetchUnreadCount();
        } catch (error) {
            console.error(error);
            runInAction(() => {
                this.error = notificationsStore.showError(error, "Не удалось загрузить уведомления");
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
            notificationsStore.showError(error, "Не удалось отметить уведомление прочитанным");
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
            notificationsStore.showError(error, "Не удалось отметить уведомления прочитанными");
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
        this.total = 0;
        this.unreadCount = 0;
        this.error = null;
    }
}

const inboxStore = new InboxStore();

export default inboxStore;
