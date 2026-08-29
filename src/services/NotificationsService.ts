import BaseService, { IResponse } from "./BaseService";
import { ListMeta } from "./http";

/** User notification (`GET /notifications`). */
export interface Notification {
    id: number;
    type: string;
    mark_id: number | null;
    task_id: number | null;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
}

export interface GetNotificationsRequest {
    limit?: number;
    offset?: number;
    unread?: boolean;
}

export interface GetNotificationsResponse extends IResponse {
    payload: Notification[];
    meta: ListMeta;
}

export interface GetUnreadCountResponse extends IResponse {
    payload: {
        count: number;
    };
}

class NotificationsService extends BaseService {
    public getNotifications(req: GetNotificationsRequest = {}): Promise<GetNotificationsResponse> {
        const params = new URLSearchParams();
        if (req.limit !== undefined) {
            params.set("limit", String(req.limit));
        }
        if (req.offset !== undefined) {
            params.set("offset", String(req.offset));
        }
        if (req.unread) {
            params.set("unread", "true");
        }
        const query = params.toString();
        return this.requestWithAuth<GetNotificationsResponse>(`/api/notifications${query ? `?${query}` : ""}`);
    }

    public getUnreadCount(): Promise<GetUnreadCountResponse> {
        return this.requestWithAuth<GetUnreadCountResponse>("/api/notifications/unread-count");
    }

    public markRead(id: number): Promise<IResponse> {
        return this.requestWithAuth(`/api/notifications/${id}/read`, { method: "PATCH" });
    }

    public markAllRead(): Promise<IResponse> {
        return this.requestWithAuth("/api/notifications/read-all", { method: "PATCH" });
    }
}

export default new NotificationsService();
